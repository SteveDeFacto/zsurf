QMAKE_CXXFLAGS += -Os -flto -std=c++0x -mno-align-double

QT += core
QT += webkitwidgets

TARGET = zsurf
TEMPLATE = app

SOURCES = zsurf.cpp

!mac:unix{
	binary.path += /bin/
	binary.files += zsurf
	INSTALLS += binary

	desktop.path += /usr/share/applications/
	desktop.files += zsurf.desktop
	INSTALLS += desktop

	man.path +=/usr/share/man/man1/
	man.files += zsurf.1	
	INSTALLS += man

	share.path += /usr/share/zsurf/
	share.files += ./scripts/*
	INSTALLS += desktop
}

HEADERS +=
