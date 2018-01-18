# intern-cucumber
cucumber-js interface for intern

See https://theintern.io/docs.html#Intern/4 for details on how to start testing with Intern.

## Quickstart

Add the plugin to your `intern.json`:

```js
    "browser": {
        "plugins": {
            "intern-cucumber/_build/browser/plugin.js"
        }
    }
    "node": {
        "plugins": {
            "intern-cucumber/src/plugin.js"
        }
    }
```
(npm support coming soon)

Load the interface and write tests:
```js
    const { registerCucumber, Given, When, Then } = intern.getInterface('cucumber');

    registerCucumber(<name>, <featureSource>, <support functions>);
```