/* example usage:
      var resizer = new Resizer(100, 100);
      resizer.onload = function() {
        resizer.paintIcons();
        print(resizer.getDataURL());
      };
      resizer.addIconByURL("http://www.google.de/images/firefox/google.gif");
      resizer.addIconByURL("data:image/gif;base64,R0lGODlhCwALAIAAAAAA3pn/ZiH5BAEAAAEALAAAAAALAAsAAAIUhA+hkcuO4lmNVindo7qyrIXiGBYAOw==");
      window.setTimeout(function() {
        resizer.addIconByURL("http://www.google.de/images/firefox/google.gif");
        resizer.addIconByURL("data:image/gif;base64,R0lGODlhCwALAIAAAAAA3pn/ZiH5BAEAAAEALAAAAAALAAsAAAIUhA+hkcuO4lmNVindo7qyrIXiGBYAOw==");
      }, 1500);
*/
function Resizer(width, height) {
  this.width = width;
  this.height = height;

  this._createCanvas();

  this.icons = [];
  for(var i = 2; i < arguments.length; i++) {
    if(arguments[i] instanceof HTMLImageElement || arguments[i] instanceof Image
       || arguments[i] instanceof HTMLCanvasElement)
      this.addIconByImage(arguments[i]);
    else if(arguments[i] instanceof Ci.nsIURI)
      this.addIconByURL(arguments[i].spec);
    else
      this.addIconByURL(arguments[i]);
  }

  this._loading = [];
}
Resizer.prototype = {
  width: 0,
  height: 0,
  _createCanvas: function() {
    var canvas = document.createElementNS("http://www.w3.org/1999/xhtml",
                                          "canvas");
    canvas.setAttribute("width", this.width);
    canvas.setAttribute("height", this.height);
    document.appendChild(canvas);
    this._canvas = canvas.getContext("2d");
  },
  onload: null,

  get loaded() {
    return this._loading.length != 0;
  },
  _loading: null,

  iconAdded: function(icon) {
    icon.squarePixels = icon.naturalWidth * icon.naturalHeight;
    if(this.loaded && this.onload) {
      this.onload.call(this, icon);
    }
  },
  addIconByURL: function(url) {
    var img = new Image();
    this._loading.push(img);
    var This = this;
    img.onload = function() {
      This.icons.push(img);
      var idx = This._loading.indexOf(img);
      This._loading = This._loading.slice(0, idx).concat(This._loading.slice(idx + 1));
      This.iconAdded(img);
    };
    img.src = url;
  },
  removeIconByURL: function(url) {
    for(var i = 0; i < this.icons.length; ++i) {
      if(this.icons[i].src == url)
        return this.removeIconByImage(this.icons[i--]);
    }
    return false;
  },
  addIconByImage: function(img) {
    this.icons.push(img);
    this.iconAdded(img);
  },
  removeIconByImage: function(img) {
    var idx = this.icons.indexOf(img);
    if(idx == -1)
      return true;
    this.icons = this.icons.slice(0, idx).concat(this.icons.slice(idx + 1));
    return true;
  },

  paintIcons: function() {
    this._canvas.fillStyle = this._canvas.strokeStyle = "rgba(254, 254, 254, 1)"
    this._canvas.fillRect(0, 0, this.width, this.height);
    var num = this.icons.length;
    var height = Math.floor(this.height / 2);
    var width = (this.width * this.height) / ((num + (num % 2)) * height);

    for(var i = 0; i < num - 1; i++) {
      this._canvas.drawImage(this.icons[i],
                             Math.floor(i / 2) * width, (i % 2) * height,
                             width, height);
    }

    if(num % 2) {
      this._canvas.drawImage(this.icons[i],
                             Math.floor(i / 2) * width, (i % 2) * height,
                             width, height * 2);
    } else {
      this._canvas.drawImage(this.icons[i],
                             Math.floor(i / 2) * width, (i % 2) * height,
                             width, height);
    }
  },
  getDataURL: function() {
    return this._canvas.canvas.toDataURL();
  }
};
