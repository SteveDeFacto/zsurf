#include <QApplication>
#include <QShortcut>
#include <QWidget>
#include <QDataStream>
#include <QFileSystemWatcher>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkProxy>
#include <QNetworkConfiguration>
#include <QNetworkDiskCache>
#include <QNetworkCookieJar>
#include <QNetworkCookie>
#include <QMessageBox>
#include <QSettings>
#include <QFileDialog>
#include <QWindow>
#include <QMainWindow>
#include <QLayout>
#include <QTimer>
#include <QList>
#include <QFileInfo>
#include <QFile>
#include <QDir>
#include <QtWebKit/QWebHistory>
#include <QtWebKit/QWebElement>
#include <QtWebKit/QWebFullScreenRequest>
#include <QtWebKitWidgets/QWebInspector>
#include <QtWebKitWidgets/QWebView>
#include <QtWebKitWidgets/QWebPage>
#include <QtWebKitWidgets/QWebFrame>

QApplication* application;
QNetworkAccessManager* manager;
QWebInspector* inspector;
QFileSystemWatcher* watcher;
QNetworkDiskCache* cache;

QList<QString> requireList;
QList<QString> scriptList;
QString configPath;
QString scriptPath;
QString downloadPath;
QString cookiePath;
QString userAgent;
QString homePage;
long embed;
long maxHistory;
bool cacheEnabled;
bool saveCookies;
bool allowPopups;

class ZNetworkCookieJar : public QNetworkCookieJar {

public :
    ZNetworkCookieJar()
    {
        // Load session cookies
        QDir cookieDir;
        cookieDir.setPath(cookiePath);
        QStringList fileList = cookieDir.entryList();
        QByteArray cookiesData;
        for(int i = 2; i < fileList.length(); i++)
        {
            QFile file(cookiePath + fileList[i]);
            if(file.open(QIODevice::ReadOnly))
            {
                cookiesData.append(file.readAll() + '\n');
                file.close();
            } else
            {
                qDebug() << "Error loading cookie:" << cookiePath << fileList[i];
            }
        }

        QList<QNetworkCookie> cookieList;
        cookieList = QNetworkCookie::parseCookies(cookiesData);
        if(cookieList.length() > 0) {
            setAllCookies(cookieList);
        }
    }

    bool setCookiesFromUrl(const QList<QNetworkCookie> &cookieList, const QUrl &url)
    {
        QNetworkCookieJar::setCookiesFromUrl(cookieList, url);
        if(saveCookies)
        {
            for(int i = 0; i < cookieList.length(); i++)
            {
                if(!cookieList[i].isSessionCookie())
                {
                    QFile file(cookiePath + cookieList[i].name());
                    if(file.open(QIODevice::WriteOnly))
                    {
                        QNetworkCookie cookie = cookieList[i];
                        if(cookie.domain()[0] != '.')
                        {
                            cookie.setDomain('.' + cookie.domain());
                        }
                        QByteArray cookieData = cookie.toRawForm();
                        file.write(cookieData.data(), cookieData.length());
                        file.close();
                        qDebug() << "Saved cookie: " << cookie.name();
                    }
                }
            }
        }
    }
};

// Extend QWebView to break fullscreen on Esc.
class ZWebView : public QWebView {

public :
    Qt::WindowStates prevWindowState;

    void keyPressEvent(QKeyEvent* e)
    {
        if(e->key() == Qt::Key_Escape && windowState() == Qt::WindowFullScreen){
            QWebView::setWindowState(prevWindowState);
            QWebView::page()->mainFrame()->evaluateJavaScript("document.webkitCancelFullScreen();");
        } else
        {
            QWebView::keyPressEvent(e);
        }
    }

    QWebView* createWindow(QWebPage::WebWindowType type)
    {
        Q_UNUSED(type);

        if(allowPopups){
            QWebView *webView = new QWebView;
            QWebPage *newWeb = new QWebPage(webView);
            newWeb->setNetworkAccessManager(manager);
            webView->setAttribute(Qt::WA_DeleteOnClose, true);
            webView->setPage(newWeb);
            webView->show();

            return webView;
        }
        else
        {
            return NULL;
        }
    }

};

QList<ZWebView*> webViews;

// Extend QWebPage to set user agent.
class ZWebPage : public QWebPage {
    QString userAgentForUrl(const QUrl &url ) const
    {
        return QString(userAgent);
    }


    bool acceptNavigationRequest(QWebFrame *frame, const QNetworkRequest &request, QWebPage::NavigationType type)
    {
        qDebug() << "navigation request was made";
        return QWebPage::acceptNavigationRequest(frame, request, type);
    }
};

// Function to load javascripts.
void loadScripts()
{
    scriptList.clear();
    for(int i = 0; i < requireList.length(); i++)
    {
        QFile file(scriptPath + requireList[i]);
        if(file.open(QIODevice::ReadOnly))
        {
            scriptList.push_back(file.readAll());
            file.close();
            qDebug() << "Script loaded:" << scriptPath << requireList[i];
        } else
        {
            qDebug() << "Error loading script:" << scriptPath << requireList[i];
        }
    }
}

// Allow live reload of javascripts.
void liveReload()
{
    watcher = new QFileSystemWatcher();

    for(int i = 0; i < requireList.length(); i++)
    {
        watcher->addPath(scriptPath + requireList[i]);
    }

    QObject::connect(watcher, &QFileSystemWatcher::fileChanged, [&, requireList]()
    {
        qDebug() << "Detected change in scripts.";
        QTimer::singleShot(1000, application, [requireList]()
        {
            loadScripts();

            for(int i = 0; i < requireList.length(); i++)
            {
                watcher->addPath(scriptPath + requireList[i]);
            }

            for (QWebView* webView : webViews)
            {
                webView->reload();
            }
        });
    });
}

// Method to open a Window.
ZWebView* openWindow(QString url, bool visible)
{

    // Initialize and show QWebView.
    ZWebView* webView = new ZWebView();

    ZWebPage* webPage = new ZWebPage();

    webPage->setNetworkAccessManager(manager);

    webView->setPage(webPage);

    webView->history()->setMaximumItemCount(maxHistory);

    // Evaluate script every time page is loaded.
    QObject::connect(webView->page()->mainFrame(), &QWebFrame::javaScriptWindowObjectCleared, [&]()
    {
        if(!cacheEnabled){
            QWebSettings::clearMemoryCaches();
        }

        for(int i = 0; i < scriptList.size(); i++)
        {
            webView->page()->mainFrame()->evaluateJavaScript(scriptList[i]);
        }
        qDebug() << "Scripts evaluated.";
    });

    // Bind inspector to key.
    QShortcut *inspectorShortcut = new QShortcut(QKeySequence("F12"), webView);
    webView->connect(inspectorShortcut, &QShortcut::activated, [&]()
    {
        if(inspector == NULL)
        {
            QWebSettings::globalSettings()->setAttribute(QWebSettings::DeveloperExtrasEnabled, true);
            inspector = new QWebInspector();
            inspector->setPage(webView->page());
            inspector->adjustSize();
            inspector->setVisible(true);
        } else
        {
            QWebSettings::globalSettings()->setAttribute(QWebSettings::DeveloperExtrasEnabled, false);
            inspector->setVisible(false);
            inspector->deleteLater();
            inspector = NULL;
        }
    });

    // Handle fullscreen request
    QObject::connect(webView->page(), &QWebPage::fullScreenRequested, [&](QWebFullScreenRequest request)
    {
        qDebug() << "Fullscreen request.";
        request.accept();
        if(request.toggleOn()){
            webView->prevWindowState = webView->windowState();
            webView->showFullScreen();
        } else {
            webView->setWindowState(webView->prevWindowState);
        }
    });

    // Handle feature request
    QObject::connect(webView->page(), &QWebPage::featurePermissionRequested, [&](QWebFrame* frame, QWebPage::Feature feature){
        qDebug() << "Accepted feature request.";
        webView->page()->setFeaturePermission(frame, feature, QWebPage::PermissionGrantedByUser);
    });

    // Handle download request
    QObject::connect(webView->page(), &QWebPage::downloadRequested, [&](QNetworkRequest request)
    {
        qDebug() << "Download requested.";
        QString fileName = QFileDialog::getSaveFileName(webView, "Save File", downloadPath + request.url().fileName());

        if(fileName != ""){
            manager->get(request);
            QObject::connect(manager, &QNetworkAccessManager::finished, [&,fileName](QNetworkReply* reply)
            {
                QFile file(fileName);
                if(file.open(QIODevice::WriteOnly))
                {
                    QDataStream out(&file);
                    out.writeRawData(reply->readAll(), reply->size()); 

                    qDebug() << "Download Complete: " << fileName;
                    QMessageBox msgBox;
                    msgBox.setText("Download Complete: " + fileName);
                    msgBox.show();
                } else
                {
                    qDebug() << "Download Failed: " << fileName;
                    QMessageBox msgBox;
                    msgBox.setText("Download Failed: " + fileName);
                    msgBox.show();
                }
            });
        }
    });

    // Handle close window request
    QObject::connect(webView->page(), &QWebPage::windowCloseRequested, [&](){
        webView->close();
    });

    if(!url.isEmpty())
    {
        // Load specified page.
        webView->load(QUrl(url));
    } else
    {
        // Evaluate scripts
        for(int i = 0; i < scriptList.size(); i++)
        {
            webView->page()->mainFrame()->evaluateJavaScript(scriptList[i]);
        }
    }

    // Display window
    if(embed)
    {
        QWidget* widget = QWidget::createWindowContainer(QWindow::fromWinId(embed));
        webView->setParent(widget);

        if(visible)
        {
            widget->show();
        }

    } else if(visible)
    {
        webView->show();
    }

    // Disable scrollbars
    webView->page()->mainFrame()->setScrollBarPolicy(Qt::Horizontal,Qt::ScrollBarAlwaysOff);
    webView->page()->mainFrame()->setScrollBarPolicy(Qt::Vertical,Qt::ScrollBarAlwaysOff);

    // Work around for resize bug.
    QTimer::singleShot(1000, application, [webView]()
    {
        int width = webView->width();
        int height = webView->height();
        webView->resize(1, 1);
        webView->resize(width, height);
    });


    webView->setAttribute(Qt::WA_DeleteOnClose, true);

    return webView;
}

// Load configuration settings.
void loadConfig()
{
    // Determine location of config
    if(configPath.isEmpty()){
        QFileInfo fileInfo(QDir::homePath() + "/.zsurf/config.ini");

        if(fileInfo.exists() && fileInfo.isFile())
        {
            configPath = fileInfo.absoluteFilePath();
        } else
        {
            configPath = "/usr/share/zsurf/config.ini";
        }
    }

    // Load config
    QSettings settings(configPath, QSettings::IniFormat);
    qDebug() << "Config loaded:" << configPath;   

    // Set popup policy
    if(!settings.value("allow_popups").isNull())
    {
        allowPopups = settings.value("allow_popups").toBool();
    } else
    {
        allowPopups = false;
    }


    // Set max history
    if(!settings.value("max_history").isNull())
    {
        maxHistory = settings.value("max_history").toInt();
    } else
    {
        maxHistory = 3;
    }

    // Determine if cache is enabled
    if(settings.value("cache_enabled").isNull()){
        QWebSettings::globalSettings()->setObjectCacheCapacities(0,0,0);
        QWebSettings::globalSettings()->setMaximumPagesInCache(0);
        cacheEnabled = false;
    } else {
        cacheEnabled = true;
    }

    // Set home page
    homePage = settings.value("home_page").toString();

    // Set script path
    if(!settings.value("script_path").isNull())
    {
        scriptPath = settings.value("script_path").toString();
    } else
    {
        scriptPath = "/usr/share/zsurf/scripts/";
    }

    // Set cache path
    if(!settings.value("cache_path").isNull())
    {
        QWebSettings::globalSettings()->setOfflineWebApplicationCachePath(settings.value("cache_path").toString());
    } else
    {
        QWebSettings::globalSettings()->setOfflineWebApplicationCachePath("/tmp/zsurf/cache/");
    }

    // Set download path
    if(!settings.value("download_path").isNull())
    {
        downloadPath = settings.value("download_path").toString();
    } else
    {
        downloadPath = QDir::homePath() + "/Downloads/";
    }

    // Set cookie path
    if(!settings.value("cookies_path").isNull())
    {
        cookiePath = settings.value("cookies_path").toString();
    } else
    {
        cookiePath = "/tmp/zsurf/cookies/";
    }

    // Create cookie jar and attach it to network manager.
    ZNetworkCookieJar* cookies = new ZNetworkCookieJar();
    manager->setCookieJar(cookies);

    // Determine if we save session cookies or not.
    saveCookies = settings.value("save_cookies").toBool();

    // Set list of scripts to require
    if(!settings.value("require_scripts").isNull())
    {
        requireList = settings.value("require_scripts").toString().split(' ');
    } else
    {
        requireList.push_back("default.js");
    }

    // Store user agent
    userAgent = settings.value("user_agent").toString();

    // Split proxy ip and port
    QStringList proxyAddress = settings.value("proxy_address").toString().split(":");

    // Connect through proxy
    QNetworkProxy proxy;
    proxy.setHostName(proxyAddress.first());
    proxy.setPort(proxyAddress.last().toInt());

    // Determine proxy type
    if(settings.value("proxy_type") == "none")
    {
        proxy.setType(QNetworkProxy::NoProxy);
    } else if(settings.value("proxy_type") == "socks5")
    {
        proxy.setType(QNetworkProxy::Socks5Proxy);
    } else if(settings.value("proxy_type") == "http")
    {
        proxy.setType(QNetworkProxy::HttpProxy);
    } else if(settings.value("proxy_type") == "http_caching")
    {
        proxy.setType(QNetworkProxy::HttpCachingProxy);
    } else if(settings.value("proxy_type") == "ftp")
    {
        proxy.setType(QNetworkProxy::FtpCachingProxy);
    } else
    {
        proxy.setType(QNetworkProxy::DefaultProxy);
    }
    QNetworkProxy::setApplicationProxy(proxy);

    // Performance Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LinksIncludedInFocusChain, settings.value("links_included_in_focus_chain").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::SpatialNavigationEnabled, settings.value("spatial_navication").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::Accelerated2dCanvasEnabled, settings.value("accelerated_2d_canvas").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::AcceleratedCompositingEnabled, settings.value("accelerated_compositing").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::DnsPrefetchEnabled, settings.value("dns_prefetch").toBool());

    // Media Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::MediaEnabled, settings.value("media_enabled").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::MediaSourceEnabled,settings.value("media_source").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebGLEnabled,settings.value("webgl").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebAudioEnabled, settings.value("web_audio").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::FullScreenSupportEnabled,settings.value("full_screen_support").toBool());

    // Privacy Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::OfflineStorageDatabaseEnabled,settings.value("offline_storage_database").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::OfflineWebApplicationCacheEnabled,settings.value("offline_web_application_cache").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalStorageDatabaseEnabled,settings.value("local_storage_database").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalStorageEnabled,settings.value("local_storage").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::PrivateBrowsingEnabled,settings.value("private_browsing").toBool());

    // Security Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::FrameFlatteningEnabled,settings.value("frame_flattening").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptCanCloseWindows,settings.value("javascript_can_close_windows").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptCanOpenWindows,settings.value("javascript_can_open_windows").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptCanAccessClipboard,settings.value("javascript_can_access_clipboard").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptEnabled,settings.value("javascript").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalContentCanAccessFileUrls, settings.value("local_content_can_access_file_urls").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalContentCanAccessRemoteUrls,settings.value("local_content_can_access_remote_urls").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::PluginsEnabled,settings.value("plugins").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebSecurityEnabled,settings.value("web_security").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::XSSAuditingEnabled,settings.value("xss_auditing").toBool());
    QWebSettings::globalSettings()->setAttribute(QWebSettings::HyperlinkAuditingEnabled, settings.value("hyperlink_auditing").toBool());
}

int main(int argc, char* argv[])
{
    // Initialize application
    application = new QApplication(argc, argv);

    // Read terminal parameters
    for(int i = 1; i < argc; i++){
        if(QString(argv[i]) == "-e"){
            i++;
            embed = QString(argv[i]).toLong();
        } else if(QString(argv[i]) == "-c"){
            i++;
            configPath = QString(argv[i]).toLong();
        } else
        {
            qDebug() << "Unknown option: " << QString(argv[i]);
        }
    }

    // Initialize network manger
    manager = new QNetworkAccessManager();

    // Load config
    loadConfig();

    // Get path of script file.
    loadScripts();

    // Watch file for changes
    liveReload();

    // Open primary web view.
    webViews.push_back( openWindow(homePage, true) );

    // Return exit status.
    return application->exec();

}
