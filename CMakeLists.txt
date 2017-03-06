cmake_minimum_required (VERSION 2.8.7)
project(zsurf)

add_executable( zsurf WIN32 zsurf.cpp)

target_link_libraries( zsurf zsurf_dynamic
	"Qt5::Core"
	"Qt5::Gui"
	"Qt5::Network"
	"Qt5::Widgets"
	"Qt5::WebKit"
	"Qt5::WebkitWidgets"
)

INSTALL(PROGRAMS zsurf DESTINATION /usr/bin)
INSTALL(PROGRAMS zsurf.desktop DESTINATION /usr/share/applications)
INSTALL(PROGRAMS zsurf.1 DESTINATION /usr/share/man/man1)
