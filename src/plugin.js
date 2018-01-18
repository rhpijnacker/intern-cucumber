const getInterface = require('./interface/cucumber').getInterface; 

intern.registerInterface('cucumber', getInterface(intern));
