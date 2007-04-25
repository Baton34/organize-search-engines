cd "D:\Erweiterungen\Organize Search Engines"


copy components\nsISEOrganizer.idl ..\xpidl

cd ..\xpidl

xpidl -w -m typelib nsISEOrganizer.idl

move /Y nsISEOrganizer.xpt "..\Organize Search Engines\components"
move /Y nsISEOrganizer.idl "..\Organize Search Engines\components"

del D:\fx\Profiles\Ext-Dev\compreg.dat
del D:\fx\Profiles\Ext-Dev\xpti.dat