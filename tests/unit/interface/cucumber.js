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
                    assert.lengthOf(suite.tests, 1, 'Suite should have one sub-suite');
                    assert.instanceOf(suite.tests[0], Suite.default, 'Sub-suite should be a suite instance');
                    
                    let subSuite = suite.tests[0];
                    assert.equal(subSuite.name, 'A scenario', 'Sub-suite should have the right name');
                    assert.equal(subSuite.numTests, 1, 'numTests should be 1');
                    assert.equal(subSuite.numFailedTests, 0, 'numFailedTests should be 0');
                    assert.lengthOf(subSuite.tests, 1, 'Sub-suite should have one test');
                    assert.instanceOf(subSuite.tests[0], Test.default, 'Test 1 should be a test instance');

                    let test = subSuite.tests[0];
                    assert.equal(test.name, 'Given x = 5', 'Test 1 should have the right name');
                    assert.isTrue(test.hasPassed, 'Test 1 should have passed');
                });
            },

            'a scenario outline should give multiple test cases'() {
                cucumberInterface.default(
                    'scenario outline',
                    'Feature: ...\nScenario Outline: A scenario with examples\nGiven x = <x>\nExamples:\n|x|\n|1|\n|2|\n|3|\n',
                    () => { cucumberInterface.Given('x = {int}', function(value) {}); }
                );
                return rootSuite.run().then(() => {
                    let parentSuite = rootSuite.tests[0];
                    assert.lengthOf(parentSuite.tests, 3, 'Parent suite 1 should have three sub-suites');
                    parentSuite.tests.forEach((subSuite) => {
                        assert.instanceOf(subSuite, Suite.default, 'Sub-suite should be a suite instance');
                        assert.lengthOf(subSuite.tests, 1, 'Sub-suite should have one test');
                        let test = subSuite.tests[0];
                        assert.instanceOf(test, Test.default, 'Test should be a test instance');
                        assert.isTrue(test.hasPassed, 'Test should have passed');
                    });
                    assert.equal(parentSuite.tests[0].name, 'A scenario with examples', 'Sub-suite should have the right name');
                    assert.equal(parentSuite.tests[1].name, 'A scenario with examples (2)', 'Sub-suite should have the right name');
                    assert.equal(parentSuite.tests[2].name, 'A scenario with examples (3)', 'Sub-suite should have the right name');

                    assert.equal(parentSuite.tests[0].tests[0].name, 'Given x = 1', 'Test 1 should have the right name');
                    assert.equal(parentSuite.tests[1].tests[0].name, 'Given x = 2', 'Test 2 should have the right name');
                    assert.equal(parentSuite.tests[2].tests[0].name, 'Given x = 3', 'Test 3 should have the right name');

                    assert.equal(parentSuite.numTests, 3, 'numTests shoud be 3');
                    assert.equal(parentSuite.numFailedTests, 0, 'numFailedTests should be 0');
                });
            },

            'it should be possible to perfom scenario step multiple times'() {
                cucumberInterface.default(
                    'repeating scenario step',
                    'Feature: ...\nScenario: A scenario\nGiven x = 5\nAnd x = 5\nAnd x = 5',
                    () => { cucumberInterface.Given('x = 5', () => {}); }
                );
                return rootSuite.run().then(() => {
                    let subSuite = rootSuite.tests[0].tests[0];
                    assert.lengthOf(subSuite.tests, 3, 'Sub-suite should have three tests');
                    assert.equal(subSuite.tests[0].name, 'Given x = 5', 'Test 1 should have the right name');
                    assert.equal(subSuite.tests[1].name, 'And x = 5', 'Test 2 should have the right name');
                    assert.equal(subSuite.tests[2].name, 'And x = 5 (2)', 'Test 2 should have the right name');

                    assert.equal(subSuite.numTests, 3, 'numTests should be 3');
                    assert.equal(subSuite.numFailedTests, 0, 'numFailedTests should be 0');
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
                    let suite = rootSuite.tests[0].tests[0];
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
                            function() {
                                assert.isDefined(this.remote, '"remote" should be part of the World');
                                assert.deepEqual(this.remote, { fake: 'fake remote' });
                            }
                        );
                    }
                );
                return rootSuite.run().then(() => {
                    let suite = rootSuite.tests[0].tests[0];
                    assert.isTrue(suite.tests[0].hasPassed, 'Test should have passed');
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
                    let test = rootSuite.tests[0].tests[0].tests[1];
                    assert.isFalse(test.hasPassed, 'Test should not have passed');
                    assert.equal(
                        test.error.message,
                        '"And y = 5" failed:\nThis fails: expected false to be truthy',
                        'Test should have the right error message'
                    );
                    assert.equal(rootSuite.tests[0].tests[0].numFailedTests, 1, 'numFailedTests should be 1');
                });
            },

            'missing Given step definition should give an error'() {
                cucumberInterface.default(
                    'missing step definition',
                    'Feature: ...\nScenario: A failing test step\nGiven x = 5',
                    () => {}
                );
                return rootSuite.run().then(() => {
                    let test = rootSuite.tests[0].tests[0].tests[0];
                    assert.isFalse(test.hasPassed, 'Test should not have passed');
                    assert.equal(
                        test.error.message,
                        '"Given x = 5" does not have a matching step definition',
                        'Test should have the right error message'
                    );
                    assert.equal(rootSuite.tests[0].tests[0].numFailedTests, 1, 'numFailedTests should be 1');
                });
            },

            'syntax errors in the feature source should give an error'() {
                this.skip('skipped until exception is fixed');
                cucumberInterface.default('garbage', '... garbage in ...', () => {});
                return rootSuite.run().then(() => {
                    assert.lengthOf(rootSuite.tests[0].tests, 0, 'Suite should have no sub-suite/tests');
                    assert.isDefined(rootSuite.tests[0].error, 'Suite should have an error');
                });
            }

        }
    };
});
