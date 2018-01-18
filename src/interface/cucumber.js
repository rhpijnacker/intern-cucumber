const cucumber = require('cucumber');
const global = require('@dojo/shim/global');
const Suite = require('intern/lib/Suite');
const Task = require('@dojo/core/async/Task');
const Test = require('intern/lib/Test');

const events = require('events');

// Make cucumber interface available
exports.Given = cucumber.Given;
exports.Then = cucumber.Then;
exports.When = cucumber.When;

function registerCucumber(featureSource /*, ...stepDefinitionInitializers */) {
    let stepDefinitionInitializers = Array.prototype.slice.call(arguments, 1);
    return _registerCucumber(global.default.intern, featureSource, stepDefinitionInitializers);
}
exports.default = registerCucumber;

function getInterface(executor) {
    return {
        registerCucumber: function(featureSource /*, ...stepDefinitionInitializers */) {
            let stepDefinitionInitializers = Array.prototype.slice.call(arguments, 1);
            return _registerCucumber(executor, featureSource, stepDefinitionInitializers);
        },
        // Make cucumber interface available
        Given: cucumber.Given,
        When: cucumber.When,
        Then: cucumber.Then
    };
}
exports.getInterface = getInterface;

function _registerCucumber(executor, featureSource, stepDefinitionInitializers) {
    executor.addSuite(function(parent) {
        let suite = _createSuite(featureSource, stepDefinitionInitializers);
        parent.add(suite);
    });
}

function _createSuite(featureSource, stepDefinitionInitializers) {
    let suite = new Suite.default({
        name: 'x',
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
    let subSuite, test, prevSuiteName, sameSuiteCount;

    eventBroadcaster.on('test-run-started', () => {
        suite.executor.emit('suiteStart', suite);
    });
    eventBroadcaster.on('test-run-finished', () => {
       suite.executor.emit('suiteEnd', suite);
    });

    eventBroadcaster.on('test-case-prepared', (event) => {
        // console.log('test-case-prepared event:', event);
    });
    eventBroadcaster.on('test-case-started', (event) => {
        // console.log('\ntest-case-started event:', event);
        let data = eventDataCollector.getTestCaseData(event.sourceLocation);
        // console.log('test-case-started data:', data);
        try {
            let name = data.pickle.name;
            if (name === prevSuiteName) {
                sameSuiteCount++;
                name = `${name} (${sameSuiteCount})`;
            } else {
                sameSuiteCount = 1;
            }
            prevSuiteName = data.pickle.name;
            subSuite = new Suite.default({ name: name });
            suite.add(subSuite);
            suite.executor.emit('suiteStart', subSuite);
        } catch(e) {
            suite.error = e;
            console.log(e);
        }
    });
    eventBroadcaster.on('test-case-finished', () => {
        suite.executor.emit('suiteEnd', subSuite);
        subSuite = null;
    });

    eventBroadcaster.on('test-step-attachment', (event) => {
        // console.log('test-step-attachment event:', event);
    });
    eventBroadcaster.on('test-step-started', (event) => {
        // console.log('\ntest-step-started event:', event);
        // console.log('test-step-started step data:', data);
        try {
            let data = eventDataCollector.getTestStepData(event);
            let name = `${data.gherkinKeyword}${data.pickleStep.text}`
            test = new Test.default({ name, test: () => {} });
            subSuite.add(test);
            suite.executor.emit('testStart', test);
        } catch(e) {
            suite.error = e;
            console.log(e);
        }
    });
    eventBroadcaster.on('test-step-finished', (event) => {
        // console.log('\ntest-step-finished event:', event);
        try {
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
