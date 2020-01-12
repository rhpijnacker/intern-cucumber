const cucumber = require('cucumber');
const { Task, global } = require('@theintern/common');
const Test = require('intern/lib/Test');
const Suite = require('intern/lib/Suite');
const events = require('events');

class CucumberSuite extends Suite.default {
  run() {
    return new Task((resolve, reject) => {
      try {
        this._createEventBroadcaster();
        this._createFeatureRunner();
        this.featureRunner
          .start()
          .then(() => {
            resolve();
          })
          .catch(e => {
            this.error = e;
            this.executor.emit('error', e);
            reject(e);
          });
      } catch (e) {
        this.error = e;
        this.executor.emit('error', e);
        reject();
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
      this.executor.emit('suiteStart', this).then(() => {
        suiteStart = Date.now();
      });
    });
    this.eventBroadcaster.on('test-run-finished', () => {
      this.timeElapsed = Date.now() - suiteStart;
      this.executor.emit('suiteEnd', this);
    });

    this.eventBroadcaster.on('test-case-prepared', event => {
      // console.log('test-case-prepared event:', event);
    });
    this.eventBroadcaster.on('test-case-started', event => {
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
        test.executor.emit('testStart', test).then(() => {
          testStart = Date.now();
        });
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

    this.eventBroadcaster.on('test-step-attachment', event => {
      // console.log('test-step-attachment event:', event);
    });
    this.eventBroadcaster.on('test-step-started', event => {
      // console.log('test-step-started event:', event);
    });
    this.eventBroadcaster.on('test-step-finished', event => {
      // console.log('test-step-finished: event', event);
      try {
        if (test.hasPassed) {
          let data = this.eventDataCollector.getTestStepData(event);
          let step = `${data.gherkinKeyword}${data.pickleStep &&
            data.pickleStep.text}`;
          test._hasPassed = event.result.status === cucumber.Status.PASSED;
          if (event.result.status === cucumber.Status.FAILED) {
            let exception = event.result.exception;
            let message = `"${step}" failed:\n${exception.message}`;
            test.error = new Error(message);
            test.error.stack = exception.stack;
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
    let testCases = cucumber.getTestCases({
      eventBroadcaster: this.eventBroadcaster,
      pickleFilter: new cucumber.PickleFilter({}),
      source: this.featureSource,
      uri: '/feature'
    });

    cucumber.supportCodeLibraryBuilder.reset('/');
    let _suite = this;
    function World() {
      if (_suite.remote) {
        // Add 'remote' for functional tests
        this.remote = _suite.remote;
      }
    }
    cucumber.setWorldConstructor(World);
    this.stepDefinitionInitializers.forEach(initializer => {
      // Pass the cucumber as the `this' context to every step definition function
      // for backward compatibility with the intern 3 cucumber integration.
      initializer.call(cucumber);
    });
    let supportCodeLibrary = cucumber.supportCodeLibraryBuilder.finalize();
    let formatterOptions = {
      cwd: '/',
      eventBroadcaster: this.eventBroadcaster,
      eventDataCollector: this.eventDataCollector,
      log: () => {},
      supportCodeLibrary
    };
    cucumber.FormatterBuilder.build('progress', formatterOptions);
    this.featureRunner = new cucumber.Runtime({
      eventBroadcaster: this.eventBroadcaster,
      testCases,
      supportCodeLibrary
    });
  }
}

class CucumberInterface {
  constructor(executor) {
    this.executor = executor;
  }

  registerCucumber(name, featureSource, ...stepDefinitionInitializers) {
    this.executor.addSuite(parent => {
      this.suite = new CucumberSuite({
        name,
        featureSource,
        stepDefinitionInitializers
      });
      parent.add(this.suite);
    });
  }
}

function getInterface(executor) {
  let instance = new CucumberInterface(executor);
  let iface = {
    registerCucumber: instance.registerCucumber.bind(instance),
    // expose cucumber interface methods
    After: cucumber.After,
    AfterAll: cucumber.AfterAll,
    Before: cucumber.Before,
    BeforeAll: cucumber.BeforeAll,
    Given: cucumber.Given,
    Then: cucumber.Then,
    When: cucumber.When,
    setWorldConstructor: cucumber.setWorldConstructor
  };
  return iface;
}

let globalInterface = getInterface(global.intern);
globalInterface.default = globalInterface.registerCucumber;
globalInterface.getInterface = getInterface;
module.exports = globalInterface;
