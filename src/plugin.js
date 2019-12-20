const { getInterface } = require('./interface/cucumber');

intern.registerInterface('cucumber', getInterface(intern));
