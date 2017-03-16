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

Some videos that use hls will cause the browser to freeze. You can work around this issue by deleting or moving libgsthls.so (sudo mv /usr/lib/gstreamer-1.0/libgsthls.so /usr/lib/gstreamer-1.0/libgsthls.so.bak)

Another workaround would be to use a plugin for video playback such as freshplayer(pepper flash), however, this is not advised since it greatly increases memory consumption and will limit your ability to interact with the plugin's controls.
