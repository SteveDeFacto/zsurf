QMAKE_CXXFLAGS += -Ofast -flto -std=c++0x

QT += core
QT += webkit
QT += webkitwidgets

TARGET = zsurf
TEMPLATE = app

CONFIG += release

SOURCES = zsurf.cpp

!mac:unix{
	binary.path += /usr/bin/
	binary.files += zsurf
	INSTALLS += binary

	desktop.path += /usr/share/applications/
	desktop.files += zsurf.desktop
	INSTALLS += desktop

	man.path += /usr/share/man/man1/
	man.files += zsurf.1	
	INSTALLS += man

	config.path += /usr/share/zsurf/
	config.files += config.ini
	INSTALLS += config

	scripts.path += /usr/share/zsurf/scripts/
	scripts.files += ./scripts/*
	INSTALLS += scripts
}
