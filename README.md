# intern-cucumber
cucumber-js interface for intern

See https://theintern.io/docs.html#Intern/4 for details on how to start testing with Intern.

## Quickstart

Install intern and intern-cucumber

```npm install --save-dev intern intern-cucumber```

Add the plugin to your `intern.json`:

```js
    "browser": {
        "plugins": {
            "node_modules/intern-cucumber/browser/plugin.js"
        }
    }
    "node": {
        "plugins": {
            "node_modules/intern-cucumber/plugin.js"
        }
    }
```

Load the interface and write tests:
```js
    const { registerCucumber, Given, When, Then } = intern.getInterface('cucumber');

    registerCucumber(<name>, <featureSource>, <support functions>);
```

See https://github.com/rhpijnacker/intern-cucumber-examples for more examples
