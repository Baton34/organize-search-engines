CALL components.bat

SET extShortName=seorganizer
SET filename=organize-search-engines_1.1b2pre.xpi
SET extFolder="D:\Erweiterungen\organize-search-engines"

SET path=%extFolder%;%path%

CD /d %extFolder%\chrome
rem make the jar file (no compression)
%ProgramFiles%\7-Zip\7z.exe u -tzip %extShortName%.jar -r * -x!*~ -x!*/CVS/* -x!*/CVSROOT/* -mx=0

cd /d %extFolder%

rem rename chrome.manifest files
ren chrome.manifest chrome.manifest.dev
ren chrome.manifest.rel chrome.manifest

rem delete the old file to start with a blank ext
del %filename%
rem make the xpi file (maximum compression)
%ProgramFiles%\7-Zip\7z.exe -mx=9 u -tzip %filename% LICENSE.txt chrome.manifest install.rdf chrome\*.jar defaults\preferences\%extShortName%.js components\*.js components\*.xpt components\*.idl

rem rename chrome.manifest files
ren chrome.manifest chrome.manifest.rel
ren chrome.manifest.dev chrome.manifest

rem cleanup after making the xpi
cd /d %extFolder%\chrome
del %extShortName%.jar