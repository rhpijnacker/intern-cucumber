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
    iface.Given = cucumber.Given;
    iface.Then = cucumber.Then;
    iface.When = cucumber.When;
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
                            eventBroadcaster
                        );
                    featureRunner.start().then(() => {
                        resolve();
                    }).catch((e) => {
                        suite.error = e;
                        // reject(e);
                        resolve();
                    });
                } catch(e) {
                    suite.error = e;
                    console.log(e);
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
    let subSuite, test, prevSuiteName, sameSuiteCount, suiteStart, subSuiteStart, testStart;

    eventBroadcaster.on('test-run-started', () => {
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
            if (prevSuiteName !== name) {
                prevSuiteName = name;
                sameSuiteCount = 1;
            } else {
                sameSuiteCount++;
                name = `${name} (${sameSuiteCount})`;
            }
            subSuite = new Suite.default({ name: name });
            suite.add(subSuite);
            suite.executor.emit('suiteStart', subSuite).then(() => {
                subSuiteStart = Date.now();
            });
        } catch(e) {
            suite.error = e;
            console.log(e);
        }
    });
    eventBroadcaster.on('test-case-finished', () => {
        subSuite.timeElapsed = Date.now() - subSuiteStart;
        suite.executor.emit('suiteEnd', subSuite);
        subSuite = null;
    });

    eventBroadcaster.on('test-step-attachment', (event) => {
        // console.log('test-step-attachment event:', event);
    });
    eventBroadcaster.on('test-step-started', (event) => {
        try {
            let data = eventDataCollector.getTestStepData(event);
            let name = `${data.gherkinKeyword}${data.pickleStep.text}`
            test = new Test.default({ name, test: () => {} });
            subSuite.add(test);
            suite.executor.emit('testStart', test).then(() => {
                testStart = Date.now();
            });
        } catch(e) {
            suite.error = e;
            console.log(e);
        }
    });
    eventBroadcaster.on('test-step-finished', (event) => {
        try {
            test._timeElapsed = Date.now() - testStart;
            test._hasPassed = event.result.status === cucumber.Status.PASSED;
            if (event.result.status === cucumber.Status.FAILED) {
                let exception = event.result.exception;
                let message = `"${test.name}" failed:\n${exception.message}`;
                test.error = new Error(message);
            } else if (event.result.status == cucumber.Status.UNDEFINED) {
                let execption = event.result.exception;
                let message = `"${test.name}" does not have a matching step definition`;
                test.error = new Error(message);
            }
            suite.executor.emit('testEnd', test);
            test = null;
        } catch(e) { 
            suite.error = e;
            console.log(e);
        }
    });
    return eventBroadcaster;
}

function _createFeatureRunner(featureSource, stepDefinitionInitializers, eventBroadcaster) {
    let testCases = cucumber.getTestCases({
        eventBroadcaster,
        pickleFilter: new cucumber.PickleFilter({}),
        source: featureSource,
        uri: '/feature'
    });

    cucumber.supportCodeLibraryBuilder.reset('/');
    stepDefinitionInitializers.forEach((initializer) => { initializer(); });
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
