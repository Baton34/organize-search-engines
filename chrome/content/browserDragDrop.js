const seOrganizer_dragObserver = {
  init: function() {
    const button = organizeSE.searchbar._engineButton;
    button.setAttribute("ondragenter", "seOrganizer_dragObserver.onDragEnter(event);");
    button.setAttribute("ondragover", "nsDragAndDrop.dragOver(event, seOrganizer_dragObserver);");
    button.setAttribute("ondragexit", "nsDragAndDrop.dragExit(event, seOrganizer_dragObserver);");
  },

  springLoadedMenuDelay: 350,
  hoveredItems: [],

  onDragEnter: function(event) {
    if(this.overButton(event.target)) {
      organizeSE.searchbar._textbox.openSearch();
    }
  },

  onDragOver: function(event, flavour, session) {
    var target = event.target;
    this.closePopups(target);
    var className = " " + target.className + " ";
    session.canDrop = (className.indexOf(" searchbar-engine-menuitem ") != -1 ||
                       className.indexOf(" searchbar-engine-menu ") != -1 ||
                       this.overButton(target));
    switch(event.target.nodeName) {
      case "menu":
        if(event.target.getAttribute("open") != "true")
          event.target.firstChild.showPopup();
        // no break!
      case "menuitem":
        event.target.setAttribute("_moz-menuactive", "true");
        break;
    }
  },
  onDragExit: function(event, session) {
    var This = this;
    var target = event.target;
    if(target.nodeName == "menu" || target.nodeName == "menuitem") {
      target.removeAttribute("_moz-menuactive");
    }
  },
  onDrop: function(event, dropData, session) {
    organizeSE.popup.hidePopup();
    if(!dropData.data)
      return;
    if(this.overButton(event.target)) {
      var searchbar = organizeSE.searchbar;
      searchbar.doSearch(dropData.data, !event.altKey);
      //searchbar.value = dropData.data;
      //searchbar.handleSearchCommand(event);
    } else {
      var items;
      if(event.target.nodeName == "menuitem") {
        items = [event.target];
      } else if(event.target.nodeName == "menu") {
        items = organizeSE.getChildItems(event.target);
      }
      var submission, engine;
      for(var i = 0; i < items.length; ++i) {
        engine = organizeSE.SEOrganizer.getEngineByName(items[i].label);
        if(engine) {
          submission = engine.getSubmission(dropData.data, null);
          if(submission) {
            if((!i && event.altKey) || content.location.href == "about:blank")
              loadURI(submission.uri.spec, null, submission.postData, false);
            else
              getBrowser().loadOneTab(submission.uri.spec, null, null,
                                      submission.postData, null, false);
          }
        }
      }
    }
  },
  getSupportedFlavours: function() {
    var flavours = new FlavourSet();
    flavours.appendFlavour("text/unicode");
    flavours.appendFlavour("text/x-moz-url");
    flavours.appendFlavour("application/x-moz-file", "nsIFile");
    return flavours;
  },

  overButton: function(target) {
    do {
      if(target.getAttribute("anonid") == "searchbar-engine-button")
        return true;
    } while((target = target.parentNode) &&
            (target.nodeType == target.ELEMENT_NODE));
    return false;
  },


  LOG: function(msg) {
    msg = "Organize Search Engines:   " + msg;
    var consoleService = Cc["@mozilla.org/consoleservice;1"]
                           .getService(Ci.nsIConsoleService);
    consoleService.logStringMessage(msg);
    return msg;
  },
  closePopups: function(target) {
    var now = (new Date()).getTime();
    var targets = [], currentTarget = target;
    do {
      if(currentTarget.nodeName == "menu")
        targets.push(currentTarget);
    } while((currentTarget = currentTarget.parentNode) &&
            (currentTarget.nodeType == currentTarget.ELEMENT_NODE));
    this.hoveredItems = this.hoveredItems.filter(function(elem, index, array) {
      var item = elem.item;
      if(!item)
        return false;
      do {
        if(targets.indexOf(item) != -1)
          return false;
      } while((item = item.parentNode) && (item.nodeType == item.ElEMENT_NODE));
      return true;
    });
    for(var i = this.hoveredItems.length; --i > -1;) {
      if(this.hoveredItems[i].time > now - this.springLoadedMenuDelay)
        break;
      if(this.hoveredItems[i].item) {
        this.closePopup(this.hoveredItems[i].item);
        this.hoveredItems = this.hoveredItems.slice(0, i);
      }
    }
    if(!this.hoveredItems.length || this.hoveredItems[0].item != target) {
      this.hoveredItems = [{item: target, time: now}].concat(this.hoveredItems);
    } else {
      this.hoveredItems[0].time = now;
    }
  },
  closePopup: function (aTarget) {
    if(aTarget.nodeName == "menupopup")
      aTarget = aTarget.parentNode;
    if(aTarget.nodeName != "menu" && aTarget.nodeName != "popupset")
      return;
    var children = organizeSE.evalXPath("descendant::xul:menu[@open='true']",
                                        aTarget);
    children.push(aTarget);
    for(var i = 0; i < children.length; ++i) {
      if(children[i] && children[i].getAttribute("open") == "true") {
        children[i].lastChild.hidePopup();
        children[i].removeAttribute("open");
      }
    }
  }
};
