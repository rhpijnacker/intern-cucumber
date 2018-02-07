const Task = require('@dojo/core/async/Task');
const Test = require('intern/lib/Test');
const sinon = require('sinon');
const Suite = require('intern/lib/Suite');

const registerSuite = intern.getInterface('object').registerSuite;
const assert = intern.getPlugin('chai').assert;
const mockRequire = intern.getPlugin('mockRequire');

registerSuite('interface/cucumber', function() {
    let cucumberInterface, removeMocks, rootSuite;
    let sandbox = sinon.sandbox.create();
    const executor = {
        addSuite: sandbox.spy(function(callback) {
            callback(rootSuite);
        }),
        emit: sandbox.spy(function() { return Task.default.resolve(); })
    };
    const getIntern = sandbox.spy(function() {
        return executor;
    });
    const mockGlobal = {
        get intern() {
            return getIntern();
        }
    }
    return {

        before: function() {
            return mockRequire(require, 'src/interface/cucumber', {
                '@dojo/shim/global': { default: mockGlobal }
            }).then(function(handle) {
                cucumberInterface = handle.module;
                removeMocks = handle.remove;
            });
        },

        after: function() {
            removeMocks();
        },

        beforeEach: function() {
            sandbox.resetHistory();
            rootSuite = new Suite.default({ name: 'root', executor: executor });
        },

        tests: {

            'sanity check'() {
                assert.lengthOf(rootSuite.tests, 0);
            },

            'cucumberInterface should implement getInterface()'() {
                const interface = cucumberInterface.getInterface(executor);
                assert.property(interface, 'registerCucumber');
                assert.isFunction(interface.registerCucumber);
            },

            'cucumberInterface should expose the cucumber methods'() {
                assert.isFunction(cucumberInterface.After);
                assert.isFunction(cucumberInterface.AfterAll);
                assert.isFunction(cucumberInterface.Before);
                assert.isFunction(cucumberInterface.BeforeAll);
                assert.isFunction(cucumberInterface.Given);
                assert.isFunction(cucumberInterface.Then);
                assert.isFunction(cucumberInterface.When);
                assert.isFunction(cucumberInterface.setWorldConstructor);
            },

            'cucumberInterface.getInterface() should expose the cucumber methods'() {
                const interface = cucumberInterface.getInterface(executor);
                assert.isFunction(interface.After);
                assert.isFunction(interface.AfterAll);
                assert.isFunction(interface.Before);
                assert.isFunction(interface.BeforeAll);
                assert.isFunction(interface.Given);
                assert.isFunction(interface.Then);
                assert.isFunction(interface.When);
                assert.isFunction(interface.setWorldConstructor);
            },

            'registerCucumber should add a suite'() {
                const interface = cucumberInterface.getInterface(executor);
                interface.registerCucumber('dummy', 'Feature: ...');
                assert.equal(executor.addSuite.callCount, 1, 'addSuite should have been called once');
                assert.lengthOf(rootSuite.tests, 1, 'There should be exactly one child suite');
                assert.instanceOf(rootSuite.tests[0], Suite.default, 'Child suite should be a suite instance');
                assert.equal(rootSuite.tests[0].name, 'dummy', 'Child suite should have the right name');
                assert.lengthOf(rootSuite.tests[0].tests, 0, 'Child suite should have no tests');
            },

            'registering a dummy cucumber should create one empty child suite'() {
                cucumberInterface.default('dummy', 'Feature: ...');
                assert.lengthOf(rootSuite.tests, 1, 'There should be exactly one child suite');
                assert.instanceOf(rootSuite.tests[0], Suite.default, 'Child suite should be a suite instance');
                assert.equal(rootSuite.tests[0].name, 'dummy', 'Child suite should have the right name');
                assert.lengthOf(rootSuite.tests[0].tests, 0, 'Child suite should have no tests');
            },

            'one scenario should give one sub-suite with one test case'() {
                cucumberInterface.default(
                    'single scenario',
                    'Feature: ...\nScenario: A scenario\nGiven x = 5',
                    () => { cucumberInterface.Given('x = 5', () => {}); }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    assert.instanceOf(suite, Suite.default, 'Sub-suite should be a suite instance');
                    assert.lengthOf(suite.tests, 1, 'Sub-suite should have one test');

                    let test = suite.tests[0];
                    assert.instanceOf(test, Test.default, 'Test should be a test instance');
                    assert.equal(test.name, 'A scenario', 'Test should have the right name');
                    assert.isTrue(test.hasPassed, 'Test should have passed');
                    assert.equal(suite.numTests, 1, 'numTests should be 1');
                    assert.equal(suite.numFailedTests, 0, 'numFailedTests should be 0');
                    assert.equal(suite.numPassedTests, 1, 'numPassedTests should be 1');
                });
            },

            'a scenario outline should give multiple test cases'() {
                cucumberInterface.default(
                    'scenario outline',
                    'Feature: ...\nScenario Outline: A scenario with examples\nGiven x = <x>\nExamples:\n|x|\n|1|\n|2|\n|3|\n',
                    () => { cucumberInterface.Given('x = {int}', function(value) {}); }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    assert.lengthOf(suite.tests, 3, 'Sub-suite should have three tests');
                    suite.tests.forEach((test) => {
                        assert.instanceOf(test, Test.default, 'Test should be a test instance');
                        assert.isTrue(test.hasPassed, 'Test should have passed');
                    });
                    assert.equal(suite.tests[0].name, 'A scenario with examples', 'Test 1 should have the right name');
                    assert.equal(suite.tests[1].name, 'A scenario with examples (2)', 'Test 2 should have the right name');
                    assert.equal(suite.tests[2].name, 'A scenario with examples (3)', 'Test 3 should have the right name');

                    assert.equal(suite.numTests, 3, 'numTests shoud be 3');
                    assert.equal(suite.numFailedTests, 0, 'numFailedTests should be 0');
                    assert.equal(suite.numPassedTests, 3, 'numPassedTests should be 3');
                });
            },

            'it should be possible to perfom scenario step multiple times'() {
                cucumberInterface.default(
                    'repeating scenario step',
                    'Feature: ...\nScenario: A scenario\nGiven x = 5\nAnd x = 5\nAnd x = 5',
                    () => { cucumberInterface.Given('x = 5', () => {}); }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    assert.lengthOf(suite.tests, 1, 'Sub-suite should have one test');
                    assert.equal(suite.numTests, 1, 'numTests should be 1');
                    let test = suite.tests[0];
                    assert.isTrue(test.hasPassed, 'Test should have passed');
                });
            },

            'it should be possible to pass multiple step definition functions'() {
                cucumberInterface.default(
                    'multiple step definitions',
                    'Feature: ...\nScenario: A scenario\nGiven x = 5\nThen x == 5',
                    () => { cucumberInterface.Given('x = 5', () => {}); },
                    () => { cucumberInterface.Then('x == 5', () => {}); }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    let test = suite.tests[0];
                    assert.isTrue(test.hasPassed, 'Test should have passed');
                });
            },

            'in functional tests "remote" should be part of the World'() {
                // Fake this.remote
                rootSuite.remote = { fake: 'fake remote' };
                cucumberInterface.default(
                    '',
                    'Feature: ...\nScenario: A scenario\nGiven x = 5',
                    () => {
                        cucumberInterface.Given(
                            'x = 5',
                            function() { // Note: using `function` is important here!
                                assert.isDefined(this.remote, '"remote" should be part of the World');
                                assert.deepEqual(this.remote, { fake: 'fake remote' });
                            }
                        );
                    }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    let test = suite.tests[0];
                    assert.isTrue(test.hasPassed, 'Test should have passed');
                });
            },

            'failing steps should give an error'() {
                cucumberInterface.default(
                    'failing steps',
                    'Feature: ...\nScenario: A failing test step\nGiven x = 5\nAnd y = 5',
                    () => {
                        cucumberInterface.Given('x = 5', () => {});
                        cucumberInterface.Given('y = 5', () => { assert.ok(false, 'This fails'); });
                    }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    let test = suite.tests[0];
                    assert.isFalse(test.hasPassed, 'Test should not have passed');
                    assert.equal(
                        test.error.message,
                        '"And y = 5" failed:\nThis fails: expected false to be truthy',
                        'Test should have the right error message'
                    );
                    assert.equal(suite.numFailedTests, 1, 'numFailedTests should be 1');
                });
            },

            'missing Given step definition should give an error'() {
                cucumberInterface.default(
                    'missing step definition',
                    'Feature: ...\nScenario: A failing test step\nGiven x = 5',
                    () => {}
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    let test = suite.tests[0];
                    assert.isFalse(test.hasPassed, 'Test should not have passed');
                    assert.equal(
                        test.error.message,
                        '"Given x = 5" does not have a matching step definition',
                        'Test should have the right error message'
                    );
                    assert.equal(suite.numFailedTests, 1, 'numFailedTests should be 1');
                });
            },

            'syntax errors in the feature source should give an error'() {
                this.skip('skipped until exception is fixed');
                cucumberInterface.default('garbage', '... garbage in ...', () => {});
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0];
                    assert.lengthOf(suite.tests, 0, 'Sub-suite should have no tests');
                    assert.isDefined(suite.error, 'Sub-suite should have an error');
                });
            }

        }
    };
});
