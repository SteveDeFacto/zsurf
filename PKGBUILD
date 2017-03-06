
# Maintainer: StevenDeFacto <srbatchelor@ovgl.org>
pkgname=xsurf
pkgver=1
pkgrel=1

pkgdesc="basic webkit2gtk browser"
arch=('i686' 'x86_64')
url="https://github.com/SteveDeFacto/zsurf"
license=('GPL')
makedepends=('git')
depends=('webkit2gtk')

source=("git+https://github.com/SteveDeFacto/zsurf.git")

build() {
	cd "$pkgname"
	make
}

package() {
	cd "$pkgname"
	make DESTDIR="$pkgdir/" install
}
md5sums=('SKIP')
