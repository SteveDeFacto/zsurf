#include <QApplication>
#include <QShortcut>
#include <QWidget>
#include <QDataStream>
#include <QFileSystemWatcher>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkProxy>
#include <QNetworkConfiguration>
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
#include <QtWebKit/QWebFullScreenRequest>
#include <QtWebKitWidgets/QWebInspector>
#include <QtWebKitWidgets/QWebView>
#include <QtWebKitWidgets/QWebFrame>

QApplication* application;
QNetworkAccessManager* manager;
QWebInspector* inspector;
QFileSystemWatcher* watcher;

QList<QString> requireList;
QList<QString> scriptList;
QString configPath;
QString scriptPath;
QString downloadPath;
QString userAgent;
QString homePage;
long embed;

// Extend QWebPage to set user agent.
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
};

QList<ZWebView*> webViews;

// Extend QWebPage to set user agent.
class ZWebPage : public QWebPage {
    QString userAgentForUrl(const QUrl &url ) const
    {
        return QString(userAgent);
    }
};

// Function to load script.
void loadScripts()
{
    scriptList.clear();
    for(int i = 0; i < requireList.length(); i++)
    {
        QFile file(scriptPath + requireList[i]);
        if(file.open(QIODevice::ReadOnly))
        {
            scriptList.push_back(file.readAll());
            qDebug() << "Script loaded:" << scriptPath << requireList[i];
        } else
        {
            qDebug() << "Error loading script:" << scriptPath << requireList[i];
        }
    }
}

// Allow live reload of script.
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

    // Evaluate script every time page is loaded.
    QObject::connect(webView->page()->mainFrame(), &QWebFrame::initialLayoutCompleted, [&]()
    {
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
            delete inspector;
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
        QString fileName = QFileDialog::getSaveFileName(webView, "Save File", downloadPath);

        if(fileName != ""){
            manager->get(request);
            QObject::connect(manager, &QNetworkAccessManager::finished, [&,fileName](QNetworkReply* reply)
            {
                QFile file(fileName);
                if(file.open(QIODevice::WriteOnly))
                {
                    QDataStream out(&file);
                    out.writeRawData(reply->readAll(), reply->size());

                    qDebug() << "Download Saved! " << fileName;
                } else
                {
                    qDebug() << "Error writing download to file. " << fileName;
                }
            });
        }
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

    // Set download path
    if(!settings.value("download_path").isNull())
    {
        downloadPath = settings.value("download_path").toString();
    } else
    {
        downloadPath = QDir::homePath() + "/Downloads/";
    }

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
