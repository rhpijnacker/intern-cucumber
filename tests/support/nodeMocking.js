"use strict";
intern.registerPlugin('mockRequire', function () {
    function mockRequire(require, mod, mocks) {
        var registeredMocks = [];
        mod = require.resolve(mod);
        registeredMocks.push({ id: mod, original: require.cache[mod] });
        delete require.cache[mod];
        Object.keys(mocks).forEach(function (name) {
            var id = require.resolve(name);
            registeredMocks.push({ id: id, original: require.cache[id] });
            delete require.cache[id];
            if (mocks[name] != null) {
                require.cache[id] = {
                    id: id,
                    filename: id,
                    loaded: true,
                    exports: mocks[name]
                };
            }
        });
        return Promise.resolve({
            module: require(mod),
            remove: function () {
                while (registeredMocks.length > 0) {
                    var _a = registeredMocks.pop(), id = _a.id, original = _a.original;
                    delete require.cache[id];
                    if (typeof original !== 'undefined') {
                        require.cache[id] = original;
                    }
                }
            }
        });
    }
    return mockRequire;
});
