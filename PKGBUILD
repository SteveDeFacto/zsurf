
# Maintainer: StevenDeFacto <srbatchelor@ovgl.org>
pkgname=zsurf
_pkgname=${pkgname%-*}
pkgver=0.1.0
pkgrel=1
pkgdesc="basic webkit2gtk browser"
arch=('i686' 'x86_64')
url="https://github.com/SteveDeFacto/zsurf"
license=('GPL3')
makedepends=('git')
depends=('qt5-webkit-ng')
provides=('zsurf=$pkgver')
conflicts=('zsurf')

source=("git+https://github.com/SteveDeFacto/zsurf.git")

build() {
	cd zsurf
	qmake
	make
}

package() {
	cd zsurf
	make INSTALL_ROOT="$pkgdir" install
}
md5sums=('SKIP')
