var organizeSE = {};
organizeSE.__proto__ = {
  onEngineListChange: function organizeSE__onEngineListChange(item) {
    if(this.inCommonDialog)
      gCommonDialogParam.SetString(13, item.selectedItem.id);
    else
      this.folderID = item.selectedItem.id;
  },
  inCommonDialog: null,
  folderID: "urn:organize-search-engines:folders-root",
  onLoad: function organizeSE__onLoad() {
    if(!document.getElementById("engineList"))
      return; // in case the user uses an old version of add to search bar
    this.observer.register();
    if("gCommonDialogParam" in window) {
      this.inCommonDialog = true;
    } else {
      this.inCommonDialog = false;
      document.documentElement.setAttribute("height", "175");
      var origOnDialogAccept = onDialogAccept;
      onDialogAccept = function(e) {
        const CONTRACT_ID =
         "@mozilla.org/rdf/datasource;1?name=organized-internet-search-engines";
        var seo = Cc[CONTRACT_ID].getService(Ci.nsISEOrganizer).wrappedJSObject;
        seo._engineFolders[document.getElementById("name").value] =
                                                            organizeSE.folderID;
        origOnDialogAccept(e);
      }
    }
  },
  onClose: function organizeSE__onClose() {
    this.observer.unregister();
  },
  observer: {
    PREFNAME: "extensions.seorganizer.sortDirection",
    observe: function organizeSE__observer__observe(subject, topic, data) {
      if(topic != "nsPref:changed" || data != "")
        return;
      subject.QueryInterface(Ci.nsIPrefBranch2);
      var direction = subject.getComplexValue("", Ci.nsISupportsString).data;
      var menupopup = document.getElementById("engineList").firstChild;
      menupopup.setAttribute("sortDirection", direction);
    },
    register: function organizeSE__observer__observe() {
      var prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);
      var branch = prefService.getBranch(this.PREFNAME);
      branch.QueryInterface(Ci.nsIPrefBranch2);
      branch.addObserver("", this, false);
      this.observe(branch, "nsPref:changed", "");
    },
    unregister: function organizeSE__observer__observe() {
      var prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);
      var branch = prefService.getBranch(this.PREFNAME);
      branch.QueryInterface(Ci.nsIPrefBranch2);
      branch.removeObserver("", this);
    }
  }
};
window.addEventListener("load", function() { organizeSE.onLoad(); }, false);
window.addEventListener("close", function() { organizeSE.onClose(); }, false);
