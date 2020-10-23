const cucumber = require('cucumber');
const { Task, global } = require('@theintern/common');
const Test = require('intern/lib/Test');
const Suite = require('intern/lib/Suite');
const events = require('events');

class CucumberSuite extends Suite.default {
  run() {
    return new Task((resolve, reject) => {
      let suiteStart;

      const startSuite = () => {
        return this.executor.emit('suiteStart', this).then(() => {
          this.eventBroadcaster.emit('test-run-started');
          suiteStart = Date.now();
        });
      };

      const endSuite = () => {
        this.timeElapsed = Date.now() - suiteStart;
        return this.executor.emit('suiteEnd', this).then(() => {
          this.eventBroadcaster.emit('test-run-finished', {
            result: this.featureRunner.result,
          });
        });
      };

      const runBeforeAll = () =>
        this.featureRunner.runTestRunHooks(
          'beforeTestRunHookDefinitions',
          'a BeforeAll'
        );

      const runAfterAll = () =>
        this.featureRunner.runTestRunHooks(
          'afterTestRunHookDefinitions',
          'an AfterAll'
        );

      const runTests = () =>
        this.featureRunner.testCases.reduce(
          (previousPromise, testCase) =>
            previousPromise.then(
              () =>
                new Promise((resolve, reject) =>
                  setTimeout(
                    () =>
                      this.featureRunner
                        .runTestCase(testCase)
                        .then(resolve)
                        .catch(reject),
                    0
                  )
                )
            ),
          Promise.resolve()
        );

      const handleError = (e) => {
        this.error = e;
        this.executor.emit('error', e);
        reject(e);
      };

      try {
        this._createEventBroadcaster();
        this._createFeatureRunner()
          .then(startSuite)
          .then(runBeforeAll)
          .then(runTests)
          .then(runAfterAll)
          .then(endSuite)
          .then(resolve)
          .catch(handleError);
      } catch (e) {
        handleError(e);
      }
    });
  }

  _createEventBroadcaster() {
    this.eventBroadcaster = new events.EventEmitter();
    this.eventDataCollector = new cucumber.formatterHelpers.EventDataCollector(
      this.eventBroadcaster
    );
    let test, used;
    let suiteStart, testStart;

    this.eventBroadcaster.on('test-run-started', () => {
      used = { test: {} }; // reset used test names
    });

    this.eventBroadcaster.on('test-case-started', (event) => {
      try {
        let data = this.eventDataCollector.getTestCaseData(
          event.sourceLocation
        );
        let name = data.pickle.name;
        let isReused = used.test[name];
        used.test[name] = (used.test[name] || 0) + 1;
        if (isReused) {
          name = `${name} (${used.test[name]})`;
        }
        test = new Test.default({ name, test: () => {}, hasPassed: true });
        this.add(test);
        testStart = Date.now();
        test.executor.emit('testStart', test);
      } catch (e) {
        this.error = e;
        console.log(e);
      }
    });

    this.eventBroadcaster.on('test-case-finished', () => {
      test._timeElapsed = Date.now() - testStart;
      test.executor.emit('testEnd', test);
      test = null;
    });

    this.eventBroadcaster.on('test-step-finished', (event) => {
      try {
        if (test.hasPassed) {
          let data = this.eventDataCollector.getTestStepData(event);
          let step = `${data.gherkinKeyword}${
            data.pickleStep && data.pickleStep.text
          }`;
          test._hasPassed = event.result.status === cucumber.Status.PASSED;
          if (event.result.status === cucumber.Status.FAILED) {
            let exception = event.result.exception;
            let message = `"${step}" failed:\n${exception.message}`;
            test.error = new Error(message);
            test.error.stack = exception.stack;
          } else if (event.result.status == cucumber.Status.AMBIGUOUS) {
            let message = event.result.exception;
            test.error = new Error(message);
          } else if (event.result.status == cucumber.Status.UNDEFINED) {
            let message = `"${step}" does not have a matching step definition`;
            test.error = new Error(message);
          }
        }
      } catch (e) {
        this.error = e;
        console.log(e);
      }
    });
  }

  _createFeatureRunner() {
    return cucumber
      .getTestCases({
        eventBroadcaster: this.eventBroadcaster,
        pickleFilter: new cucumber.PickleFilter({}),
        source: this.featureSource,
        uri: '/feature',
      })
      .then((testCases) => {
        cucumber.supportCodeLibraryBuilder.reset('/');
        let _suite = this;
        function World() {
          if (_suite.remote) {
            // Add 'remote' for functional tests
            this.remote = _suite.remote;
          }
        }
        cucumber.setWorldConstructor(World);
        const stepDefinitionFunctions = Object.freeze(cucumberFunctions());
        this.stepDefinitionInitializers.forEach((initializer) => {
          // Pass the cucumber as the `this' context to every step definition function
          // for backward compatibility with the intern 3 cucumber integration.
          initializer.call(stepDefinitionFunctions);
        });
        let supportCodeLibrary = cucumber.supportCodeLibraryBuilder.finalize();
        let formatterOptions = {
          cwd: '/',
          eventBroadcaster: this.eventBroadcaster,
          eventDataCollector: this.eventDataCollector,
          log: () => {},
          supportCodeLibrary,
        };
        cucumber.FormatterBuilder.build('progress', formatterOptions);
        this.featureRunner = new cucumber.Runtime({
          eventBroadcaster: this.eventBroadcaster,
          testCases,
          supportCodeLibrary,
        });
      });
  }
}

class CucumberInterface {
  constructor(executor) {
    this.executor = executor;
  }

  registerCucumber(name, featureSource, ...stepDefinitionInitializers) {
    this.executor.addSuite((parent) => {
      this.suite = new CucumberSuite({
        name,
        featureSource,
        stepDefinitionInitializers,
      });
      parent.add(this.suite);
    });
  }
}

function cucumberFunctions() {
  return {
    After: cucumber.After,
    AfterAll: cucumber.AfterAll,
    Before: cucumber.Before,
    BeforeAll: cucumber.BeforeAll,
    Given: cucumber.Given,
    Then: cucumber.Then,
    When: cucumber.When,
    setWorldConstructor: cucumber.setWorldConstructor,
  };
}

function getInterface(executor) {
  let instance = new CucumberInterface(executor);
  let iface = {
    registerCucumber: instance.registerCucumber.bind(instance),
    // expose cucumber interface methods
    ...cucumberFunctions(),
  };
  return iface;
}

let globalInterface = getInterface(global.intern);
globalInterface.default = globalInterface.registerCucumber;
globalInterface.getInterface = function (...args) {
  let iface = getInterface(...args);
  return Object.freeze(iface);
};
module.exports = Object.freeze(globalInterface);
