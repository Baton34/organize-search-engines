function Reporter(err) {
  this.report = new Reporter.Report(err, true);
  this.report.userTypedMessage = prompt("aaaa", "");

  var prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch)
                .getBranch("extensions.seorganizer.reporter.");
  if(!prefs.getBoolPref("sendReports"))
    return;

  if(prefs.getBoolPref("confirmSending")) {
    var abort = {}, message = {};
    openDialog("chrome://seorganizer/content/reporter-confirmation.xul","_blank",
               "chrome,dialog=no,modal=no,resizable=no", this.report, abort,
               message);
    if(abort.value)
      return;
    this.report.userTypedMessage = message.value;
  }

  this.sendReport();
}
Reporter.prototype = {
  report: null,
  sent: 0,
  queueReport: function Reporter__queueReport() {
    var This = this;
    if(this.sent < 4) {
      setTimeout(function() { This.sendReport(); }, 500);
    } else {
      setTimeout(function() { This.sendReport(); }, 10000);
    }
  },
  getURI: function() {
    if(this._uri)
      return this._uri;
    var app = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo)
                .QueryInterface(Ci.nsIXULRuntime);
    var item = Cc["@mozilla.org/extensions/manager;1"]
                 .getService(Ci.nsIExtensionManager)
                 .getItemForID("organize-search-engines@maltekraus.de");

    var prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);
    var uri = prefs.getComplexValue("extensions.seorganizer.reporter.url",
                                    Ci.nsISupportsString).data;

    uri = uri.replace(/%ITEM_ID%/g, item.id);
    uri = uri.replace(/%ITEM_VERSION%/g, item.version);
    uri = uri.replace(/%APP_ID%/g, app.ID);
    uri = uri.replace(/%APP_VERSION%/g, app.version);
    uri = uri.replace(/%REQ_VERSION%/g, 1);
    uri = uri.replace(/%APP_OS%/g, app.OS);
    return this._uri = uri;
  },
  getXML: function Reporter__getXML() {
    var doc = document.implementation.createDocument("", "", null);
    var root = doc.createElement("report");
    var child = doc.createElement("type");
    child.appendChild(doc.createTextNode(this.report.type));
    root.appendChild(child);
    child = doc.createElement("fileName");
    child.appendChild(doc.createTextNode(this.report.fileName));
    root.appendChild(child);
    child = doc.createElement("lineNumber");
    child.appendChild(doc.createTextNode(this.report.lineNumber));
    root.appendChild(child);
    child = doc.createElement("message");
    child.appendChild(doc.createTextNode(this.report.message));
    root.appendChild(child);
    child = doc.createElement("userMessage");
    child.appendChild(doc.createTextNode(this.report.userMessage));
    root.appendChild(child);
    child = doc.createElement("stack");
    child.appendChild(doc.createTextNode(this.report.stack));
    root.appendChild(child);
    doc.appendChild(root);

    var serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  },
  sendReport: function Reporter__sendReport() {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIJSXMLHttpRequest);
    req.open("GET", this.getURI(), true);
    req.onreadystatechange = function() {
      if(req.readyState != 4)
        return;
      clearTimeout(timeout);
      if(req.status != 200)
        return this.queueReport();

      var doc = req.responseXML;
      var elems = doc.getElementsByTagName("error");
      if(elems.length) {
        return this.queueReport();
      }
    };
    req.send(this.report.toString());
    this.sent += 1;

    var This = this;
    var timeout = setTimeout(function timeout(){
      This.queueReport();
      req.abort();
    }, 10000); // 10 seconds
  }
};

Reporter.Report = function Reporter__Report(error) {
  this._base = error;
  if(error ) {
    if(error instanceof Error) {
      this.initFromError(error);
    } else if(error instanceof Ci.nsIScriptError) {
      this.initFromXPComError(error);
    } else {
      this.initFromString(error);
    }
  }
};
Reporter.Report.prototype = {
  _base: null,
  type: null,
  fileName: null,
  lineNumber: null,
  message: null,
  userTypedMessage: "",
  stack: null,

  initFromError: function Reporter__Report__initFromError(err) {
    this.fileName = err.fileName;
    this.lineNumber = err.lineNumber;
    this.message = err.message;
    this.stack = err.stack;
    this.type = err.name;
  },
  initFromString: function Reporter__Report__initFromError(err) {
    this.fileName = "";
    this.lineNumber = 0;
    this.message = err.toString();
    this.stack = "";
    this.type = "";
  },
  initFromXPComError: function Reporter__Report__initFromXPComError(err) {
    this.fileName = err.sourceName;
    this.lineNumber = err.lineNumber;
    this.message = err.errorMessage + "\n\n" + err.message;
    this.stack = "";

    if(err.flags & Ci.nsIScriptError.strictFlag || err.flags & Ci.nsIScriptError.warningFlag)
      throw new Error("Error not sever enough!");
    else if(err.flags & Ci.nsIScriptError.exceptionFlag)
      this.type = "exception";
    else if(err.flags == Ci.nsIScriptError.errorFlag)
      this.type = "error";
  },

  toString: function Reporter__Report__toString(xml) {
    if(arguments.length != 0 && !xml)
      return this._base.toString();
  }
};
