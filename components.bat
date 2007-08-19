cd "D:\Erweiterungen\organize-search-engines\"


copy components\nsISEOrganizer.idl ..\xpidl

cd ..\xpidl

xpidl -w -m typelib nsISEOrganizer.idl

move /Y nsISEOrganizer.xpt "..\organize-search-engines\components"
move /Y nsISEOrganizer.idl "..\organize-search-engines\components"

del D:\fx\Profiles\Ext-Dev\compreg.dat
del D:\fx\Profiles\Ext-Dev\xpti.dat