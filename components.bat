cd "D:\Erweiterungen\ose2"


copy components\nsISEOrganizer.idl ..\xpidl

cd ..\xpidl

xpidl -w -m typelib nsISEOrganizer.idl

move /Y nsISEOrganizer.xpt "..\ose2\components"
move /Y nsISEOrganizer.idl "..\ose2\components"

del D:\fx\Profiles\Ext-Dev\compreg.dat
del D:\fx\Profiles\Ext-Dev\xpti.dat