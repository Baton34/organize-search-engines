cd "D:\Erweiterungen\"


copy organize-search-engines\components\nsISEOrganizer.idl xpidl

cd xpidl
xpidl -w -m typelib nsISEOrganizer.idl

move /Y nsISEOrganizer.xpt "..\organize-search-engines\components"
del nsISEOrganizer.idl

del D:\fx\Profiles\Ext-Dev\compreg.dat
del D:\fx\Profiles\Ext-Dev\xpti.dat