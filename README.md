#zsurf
about:

zsurf - zero surf

Absolutely minimal code to initialize QtWebKit1. This browser is intended for use on systems with limited memory such as Raspberry PI Zero. QtWebKit1 includes recent security patches from Apple and it is also single threaded which greatly reduces memory usage.

No AdBlock:
I recommend using Privoxy with EasyList.

No GUI or Hot Keys:
Intended to be used with a custom Javascript user interface which will be executed by the browser engine. The browser only exposes browser options to the script.js file.

Security Considerations:
The JavaScript interface needs to use something like WeakMaps to make all methods, variables, and classes private. Otherwise, a malicious script can gain control of your browser options. A secure implementation has not been developed yet. No default script has be included in order to hopefully promote security through obscurity.

compile and install: 

make
make install
