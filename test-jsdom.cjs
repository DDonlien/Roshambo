const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

JSDOM.fromURL("http://localhost:5176/", { runScripts: "dangerously", resources: "usable" }).then(dom => {
  dom.window.addEventListener('error', event => {
    console.log('JSDOM ERROR:', event.message);
  });
  dom.window.console.log = (...args) => console.log('JSDOM LOG:', ...args);
  dom.window.console.error = (...args) => console.log('JSDOM CONSOLE ERROR:', ...args);
  
  setTimeout(() => {
    console.log('DOM Content:', dom.window.document.body.innerHTML.substring(0, 500));
  }, 2000);
});
