#zsurf
about:

zsurf - Zero Surf

Absolutely minimal code to initialize QtWebKit1 with a few required features. This browser is intended primarily for use on systems with limited memory. Zero Surf uses QtWebKit1 which includes recent security patches from Apple and is also single threaded which greatly reduces memory usage.

This is not the browser's final form and much work needs to be done to compile Qt to reduce memory usage further. The browser includes a simple script which offers Vim key bindings and simple hits. Future versions will offer a variety of scripts including extremely feature rich options.

No AdBlock:
Future versions will offer a JavaScript based AdBlocker. I recommend using Privoxy with EasyList for the time being.

compile and install: 

make
make install
