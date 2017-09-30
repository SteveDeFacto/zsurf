#include "zsurf.h"

ZBrowser *browser;
QApplication *application;
QFileSystemWatcher *watcher;
ZWebEngineUrlRequestInterceptor *requestInterceptor;
QList<ZWebEngineView*> webEngineViews;
QList<QString> requireList;
QList<QWebEngineScript> scriptList;
QString configPath;
QString scriptPath;
QString downloadPath;
QString cookiePath;
QString cachePath;
QString userAgent;
QString homePage;
QString cacheType;
QStringList spellCheckLanguages;
long embed;
bool cacheEnabled;
bool saveCookies;
bool allowPopups;
bool spellCheck;


// Content filtering
/*
class ZWebEngineUrlRequestInterceptor : public QWebEngineUrlRequestInterceptor {

public:
    ZWebEngineUrlRequestInterceptor(QObject* parent = Q_NULLPTR)
      :QWebEngineUrlRequestInterceptor(parent) {

    }

    void interceptRequest(QWebEngineUrlRequestInfo &info){
        //info.block(true);
    }
};
*/

// Extend QWebView to break fullscreen on Esc.
class ZWebEngineView : public QWebEngineView {

public :

    Qt::WindowStates prevWindowState;

    ZWebEngineView(QString url, QWebEngineProfile *profile, bool visible)
    {
        if(profile != NULL)
        {
            setPage(new QWebEnginePage(profile, this));
        }

        // Add scripts to page
        for(int i = 0; i < scriptList.length(); i++) {
            page()->scripts().insert(scriptList[i]);
        }
        // Configure user agent
        page()->profile()->setHttpUserAgent(userAgent);

        // Configure spellchecking
        page()->profile()->setSpellCheckEnabled(spellCheck);
        page()->profile()->setSpellCheckLanguages(spellCheckLanguages);

        // Configure cache
        page()->profile()->setCachePath(cachePath);
        if(cacheType == "none")
        {
            page()->profile()->setHttpCacheType(QWebEngineProfile::NoCache);
        } else if(cacheType == "disk")
        {
            page()->profile()->setHttpCacheType(QWebEngineProfile::DiskHttpCache);
        } else if(cacheType == "memory")
        {
            page()->profile()->setHttpCacheType(QWebEngineProfile::MemoryHttpCache);
        }

        // Configure cookies
        page()->profile()->setPersistentStoragePath(cookiePath);
        if(saveCookies)
        {
            page()->profile()->setPersistentCookiesPolicy(QWebEngineProfile::AllowPersistentCookies);
        } else
        {
            page()->profile()->setPersistentCookiesPolicy(QWebEngineProfile::NoPersistentCookies);
        }

        // Handle fullscreen request
        QObject::connect(page(), &QWebEnginePage::fullScreenRequested, [&](QWebEngineFullScreenRequest fullScreenRequest)
        {
            qDebug() << "Fullscreen request.";
            fullScreenRequest.accept();
            if(fullScreenRequest.toggleOn()){
                prevWindowState = windowState();
                showFullScreen();
            } else {
                setWindowState(prevWindowState);
            }
        });

        // Handle feature request
        QObject::connect(page(), &QWebEnginePage::featurePermissionRequested, [&](const QUrl &securityOrigin, QWebEnginePage::Feature feature){
            qDebug() << "Accepted feature request.";
            page()->setFeaturePermission(securityOrigin, feature, QWebEnginePage::PermissionGrantedByUser);
        });

        // Handle download request
        QObject::connect(page()->profile(), &QWebEngineProfile::downloadRequested, [&](QWebEngineDownloadItem* download)
        {
            qDebug() << "Download requested.";
            QString fileName = QFileDialog::getSaveFileName(this, "Save File", downloadPath + download->url().fileName());
            if(fileName != ""){
                download->setPath(fileName);
                download->accept();
                QObject::connect(download, &QWebEngineDownloadItem::stateChanged, [&, fileName](QWebEngineDownloadItem::DownloadState state)
                {
                    if(state == QWebEngineDownloadItem::DownloadCompleted)
                    {
                        qDebug() << "Download Complete: " << fileName;
                        QMessageBox* msgBox = new QMessageBox();
                        msgBox->setText("Download Complete: " + fileName);
                        msgBox->show();
                    } else
                    {
                        qDebug() << "Download Failed: " << fileName;
                        QMessageBox* msgBox = new QMessageBox();
                        msgBox->setText("Download Failed: " + fileName);
                        msgBox->show();
                    }
                });
            }
        });

        // Handle close window request
        QObject::connect(page(), &QWebEnginePage::windowCloseRequested, [&](){
            qDebug()<<"Close window.";
            close();
        });


        // Load specified page.
        if(!url.isEmpty())
        {
            load(QUrl(url));
        }

        // Display window
        if(embed)
        {
            QWidget* widget = QWidget::createWindowContainer(QWindow::fromWinId(embed));
            setParent(widget);

            if(visible)
            {
                widget->show();
            }

        } else if(visible)
        {
            show();
        }

        // Work around for resize bug.
        if(webEngineViews.length() == 0){
            QTimer::singleShot(1000, application, [this]()
            {
                int oldWidth = width();
                int oldHeight = height();
                resize(1, 1);
                resize(oldWidth, oldHeight);
            });
        }
        setAttribute(Qt::WA_DeleteOnClose, true);

        webEngineViews.push_back(this);
    }

    ZWebEngineView() : ZWebEngineView("", NULL, true) {}

    ZWebEngineView* createWindow(QWebEnginePage::WebWindowType type)
    {
        Q_UNUSED(type);

        if(allowPopups){
            ZWebEngineView* webView = new ZWebEngineView();
            qDebug() << "New window";
            return webView;
        }
        else
        {
            return NULL;
        }
    }
};

ZTab::ZTab()
{
    this->zoomFactor = 1.0f;
}

ZTab::~ZTab(){

}

float ZTab::getZoomFactor() const
{
    return this->zoomFactor;
}

void ZTab::setZoomFactor(float zoomFactor)
{
    this->zoomFactor = zoomFactor;
    emit zoomFactorChanged();
}

ZTabs::ZTabs()
{
    current = 0;
    tabsList.push_back(new ZTab());
}
/*
Promise ZTabs::setZoom(int tabId, float zoomFactor)
{
    tabsList[tabId]->setZoomFactor(zoomFactor);
}

Promise ZTabs::getZoom(float& zoomFactor)
{
    zoomFactor = tabsList[current]->getZoomFactor();
}
*/
int ZTabs::getCurrent()
{
    return current;
}
ZBrowser::ZBrowser()
{

    tabs = new ZTabs();

    profile = new QWebEngineProfile("Default");

/*
    QFile webChannelJsFile(":/qtwebchannel/qwebchannel.js");
    if( !webChannelJsFile.open(QIODevice::ReadOnly) )
    {
        qDebug() << QString("Couldn't open qwebchannel.js file: %1").arg(webChannelJsFile.errorString());
    }
    else
    {
        QByteArray webChannelJs = webChannelJsFile.readAll();
        webChannelJs.append(
            "\n"
            "var browser"
            "\n"
            "new QWebChannel(qt.webChannelTransport, function(channel) {"
            "     browser = channel.objects.browser;"
            "});"
        );

        QWebEngineScript script;
        script.setSourceCode(webChannelJs);
        script.setName("qwebchannel.js");
        script.setWorldId(QWebEngineScript::MainWorld);
        script.setInjectionPoint(QWebEngineScript::DocumentCreation);
        script.setRunsOnSubFrames(false);
        profile->scripts()->insert(script);

        qDebug() << "Loaded WebExtensions API!";
    }

    // Add url request interceptor to page profile
    requestInterceptor = new ZWebEngineUrlRequestInterceptor();
    profile->setRequestInterceptor(requestInterceptor);
*/

    webEngineView = new ZWebEngineView(homePage, profile, true);

    ZTab* test = new ZTab();
/*
    // Set web channel for page
    QWebChannel *channel = new QWebChannel();
    webEngineView->page()->setWebChannel(channel);
    channel->registerObject(QStringLiteral("browser"), (QObject*)test);

*/
}

// Load javascripts.
void loadScripts()
{
    scriptList.clear();

    for(int i = 0; i < requireList.length(); i++)
    {
        QFile file(scriptPath + requireList[i]);
        if(file.open(QIODevice::ReadOnly))
        {

            QWebEngineScript script;
            script.setSourceCode(file.readAll());
            script.setWorldId(QWebEngineScript::ApplicationWorld);
            script.setInjectionPoint(QWebEngineScript::DocumentCreation);
            script.setRunsOnSubFrames(true);
            scriptList.push_back(script);
            file.close();
            qDebug() << "Script loaded:" << scriptPath << requireList[i];
        } else
        {
            qDebug() << "Error loading script:" << scriptPath << requireList[i];
        }
    }

    for(int i = 0; i < webEngineViews.length(); i++){
        webEngineViews[i]->page()->scripts().clear();
        webEngineViews[i]->page()->scripts().insert(scriptList);
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

            for (QWebEngineView* webEngineView : webEngineViews)
            {
                webEngineView->reload();
            }
        });
    });
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

    // Configure spell check
    spellCheck = settings.value("spell_check").toBool();
    spellCheckLanguages = settings.value("spell_check_languages").toString().split(",");

    // Set popup policy
    if(!settings.value("allow_popups").isNull())
    {
        allowPopups = settings.value("allow_popups").toBool();
    } else
    {
        allowPopups = false;
    }

    // Determine if cache is enabled
    if(settings.value("cache_type").isNull())
    {
        cacheType = settings.value("cache_type").toString();
    } else {
        cacheType = "memory";
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
        cachePath = settings.value("cache_path").toString();
    } else
    {
        cachePath = "/tmp/zsurf/cache/";
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
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::LinksIncludedInFocusChain, settings.value("links_included_in_focus_chain").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::SpatialNavigationEnabled, settings.value("spatial_navication").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::Accelerated2dCanvasEnabled, settings.value("accelerated_2d_canvas").toBool());

    // Media Settings
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::WebGLEnabled,settings.value("webgl").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::FullScreenSupportEnabled,settings.value("full_screen_support").toBool());

    // Privacy Settings
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::LocalStorageEnabled,settings.value("local_storage").toBool());

    // Security Settings
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows,settings.value("javascript_can_open_windows").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard,settings.value("javascript_can_access_clipboard").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::JavascriptEnabled,settings.value("javascript").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, settings.value("local_content_can_access_file_urls").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls,settings.value("local_content_can_access_remote_urls").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::PluginsEnabled,settings.value("plugins").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::XSSAuditingEnabled,settings.value("xss_auditing").toBool());
    QWebEngineSettings::globalSettings()->setAttribute(QWebEngineSettings::HyperlinkAuditingEnabled, settings.value("hyperlink_auditing").toBool());
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

    // Load config
    loadConfig();

    // Get path of script file.
    loadScripts();

    // Watch file for changes
    liveReload();

    // Open primary web view.
    browser = new ZBrowser();

    // Return exit status.
    return application->exec();
}
