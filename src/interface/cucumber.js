const cucumber = require('cucumber');
const global = require('@dojo/shim/global');
const Suite = require('intern/lib/Suite');
const Task = require('@dojo/core/async/Task');
const Test = require('intern/lib/Test');

const events = require('events');

function registerCucumber(name, featureSource, ...stepDefinitionInitializers) {
    return _registerCucumber(global.default.intern, name, featureSource, stepDefinitionInitializers);
}
exports.default = registerCucumber;

function getInterface(executor) {
    let iface = {
        registerCucumber: function(name, featureSource, ...stepDefinitionInitializers) {
            return _registerCucumber(executor, name, featureSource, stepDefinitionInitializers);
        }
    };
    _publishCucumberInterface(iface);
    return iface;
}
exports.getInterface = getInterface;

_publishCucumberInterface(exports);

function _publishCucumberInterface(iface) {
    iface.After = cucumber.After;
    iface.AfterAll = cucumber.AfterAll;
    iface.Before = cucumber.Before;
    iface.BeforeAll = cucumber.BeforeAll;
    iface.Given = cucumber.Given;
    iface.Then = cucumber.Then;
    iface.When = cucumber.When;
    iface.setWorldConstructor = cucumber.setWorldConstructor;
}

function _registerCucumber(executor, name, featureSource, stepDefinitionInitializers) {
    executor.addSuite(function(parent) {
        let suite = _createSuite(name, featureSource, stepDefinitionInitializers);
        parent.add(suite);
    });
}

function _createSuite(name, featureSource, stepDefinitionInitializers) {
    let suite = new Suite.default({
        name,
        run: () => {
            return new Task.default((resolve, reject) => {
                try {
                    let eventBroadcaster = _createEventBroadcaster(suite);
                    let featureRunner =
                        _createFeatureRunner(
                            featureSource,
                            stepDefinitionInitializers,
                            eventBroadcaster,
                            suite
                        );
                    featureRunner.start().then(() => {
                        resolve();
                    }).catch((e) => {
                        suite.error = e;
                        suite.executor.emit('error', e);
                        reject(e);
                    });
                } catch(e) {
                    suite.error = e;
                    suite.executor.emit('error', e);
                    reject();
                }
            });
        }
    });
    return suite;
}

function _createEventBroadcaster(suite) {
    let eventBroadcaster = new events.EventEmitter();
    let eventDataCollector = new cucumber.formatterHelpers.EventDataCollector(eventBroadcaster);
    let test, used;
    let suiteStart, testStart;

    eventBroadcaster.on('test-run-started', () => {
        used = { test: {} }; // reset used test names
        suite.executor.emit('suiteStart', suite).then(() => {
            suiteStart = Date.now();
        });
    });
    eventBroadcaster.on('test-run-finished', () => {
        suite.timeElapsed = Date.now() - suiteStart;
        suite.executor.emit('suiteEnd', suite);
    });

    eventBroadcaster.on('test-case-prepared', (event) => {
        // console.log('test-case-prepared event:', event);
    });
    eventBroadcaster.on('test-case-started', (event) => {
        try {
            let data = eventDataCollector.getTestCaseData(event.sourceLocation);
            let name = data.pickle.name;
            let isReused = used.test[name];
            used.test[name] = (used.test[name] || 0) + 1;
            if (isReused) {
                name = `${name} (${used.test[name]})`;
            }
            test = new Test.default({ name, test: () => {}, hasPassed: true });
            suite.add(test);
            test.executor.emit('testStart', test).then(() => {
                testStart = Date.now();
            });
        } catch(e) {
            suite.error = e;
            console.log(e);
        }
    });
    eventBroadcaster.on('test-case-finished', () => {
        test._timeElapsed = Date.now() - testStart;
        test.executor.emit('testEnd', test);
        test = null;
    });

    eventBroadcaster.on('test-step-attachment', (event) => {
        // console.log('test-step-attachment event:', event);
    });
    eventBroadcaster.on('test-step-started', (event) => {
        // console.log('test-step-started event:', event);
    });
    eventBroadcaster.on('test-step-finished', (event) => {
        // console.log('test-step-finished: event', event);
        try {
            if (test.hasPassed) {
                let data = eventDataCollector.getTestStepData(event);
                let step = `${data.gherkinKeyword}${data.pickleStep && data.pickleStep.text}`
                test._hasPassed = event.result.status === cucumber.Status.PASSED;
                if (event.result.status === cucumber.Status.FAILED) {
                    let exception = event.result.exception;
                    let message = `"${step}" failed:\n${exception.message}`;
                    test.error = new Error(message);
                } else if (event.result.status == cucumber.Status.UNDEFINED) {
                    let execption = event.result.exception;
                    let message = `"${step}" does not have a matching step definition`;
                    test.error = new Error(message);
                }
            }
        } catch(e) { 
            suite.error = e;
            console.log(e);
        }
    });
    return eventBroadcaster;
}

function _createFeatureRunner(featureSource, stepDefinitionInitializers, eventBroadcaster, suite) {
    let testCases = cucumber.getTestCases({
        eventBroadcaster,
        pickleFilter: new cucumber.PickleFilter({}),
        source: featureSource,
        uri: '/feature'
    });

    cucumber.supportCodeLibraryBuilder.reset('/');
    function World() {
        if (suite.remote) {
            // Add 'remote' for functional tests
            this.remote = suite.remote;
        }
    }
    cucumber.setWorldConstructor(World);
    stepDefinitionInitializers.forEach((initializer) => {
        // Pass the cucumber as the `this' context to every step definition function
        // for backward compatibility with the intern 3 cucumber integration.
        initializer.call(cucumber);
    });
    let supportCodeLibrary = cucumber.supportCodeLibraryBuilder.finalize();

    let eventDataCollector =
        new cucumber.formatterHelpers.EventDataCollector(eventBroadcaster);
    let formatterOptions = {
        cwd: '/',
        eventBroadcaster,
        eventDataCollector,
        log: () => {},
        supportCodeLibrary
    };
    cucumber.FormatterBuilder.build('progress', formatterOptions);

    let runner = new cucumber.Runtime({
        eventBroadcaster,
        options: { failFast: true },
        testCases,
        supportCodeLibrary
    });
    return runner;
}
