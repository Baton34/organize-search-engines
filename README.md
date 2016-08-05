# Расширение "Organize Search Engines" для Firefox

Предоставляет расширенные возможности по управлению поисковыми плагинами **Firefox**:
* создание папок
* создание разделителей
* изменение порядка плагинов в списке
* редактирование и удаление плагинов
* поиск во всех плагинах папки нажатием одной кнопки

Автор оригинального расширения Malte Kraus.


Так как в **Firefox 48** отключена возможность отключения проверки цифровых подписей расширений через *about:config*, для установки данного расширения
нужно сделать следующее:

1.  создать файл **config.js** в папке *(C:\Program Files\Mozilla Firefox)* с содержанием:

	```
  //
  try {
  Components.utils.import("resource://gre/modules/addons/XPIProvider.jsm", {})
  .eval("SIGNED_TYPES.clear()");
  }
  catch(ex) {}
  ```
2.  создать файл **config-prefs.js** в папке *(C:\Program Files\Mozilla Firefox\defaults\pref)* с содержанием:

  ```
  pref("general.config.obscure_value", 0);
  pref("general.config.filename", "config.js");
  ```
3. перезапустить Firefox и установить xpi-файл
