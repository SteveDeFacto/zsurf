zsurf - simple QtWebKit1 browser. 

This browser is intended primarily for use on systems with limited memory. ZSurf uses QtWebKit1 which includes recent security patches from Apple and is also single threaded which greatly reduces memory usage.

The browser currently includes a simple script which offers Vim key bindings and simple hits. Future versions will offer a variety of scripts.

No AdBlock:
Future versions will offer a JavaScript based AdBlocker. I recommend using Privoxy with EasyList for the time being.

Build/Install Instructions:

qmake

make

sudo make install

Issue with video streaming:

QtWebKit appears to have a memory leak in its implementation of gstreamer. Additionally, there appears to be an issue with some HLS videos which causes the browser to freeze. I suggest using FreshPlayer as a workaround for the time being. It's not as convenient since controlling videos will have to be done with mouse clicks. If a mouse is not an option, I suggest using KeyNav to perform the mouse clicks.
