#include <stdio.h>
#include <unistd.h>
#include <QApplication>
#include <QShortcut>
#include <QWidget>
#include <QFileSystemWatcher>
#include <QNetworkProxy>
#include <QFile>
#include <QDir>
#include <QtWebKitWidgets/QWebInspector>
#include <QtWebKitWidgets/QWebView>
#include <QtWebKitWidgets/QWebFrame>

QWebView* webView;
QWebInspector* inspector;
QString script;

// Function to load script.
void loadScript(QString path){
    QFile file(path);
    if(file.open(QIODevice::ReadOnly))
    {
        script = file.readAll();
        qDebug() << "Script loaded." << path;
    } else
    {
        qDebug() << "Error loading script." << path;
    }
}

// Function to evaluate script.
void evaluateScript(){
    webView->page()->mainFrame()->evaluateJavaScript(script);
    qDebug() << "Script evaluated.";
}

int main(int argc, char* argv[])
{ 
    QApplication application(argc, argv);

    // Connect through proxy
    QNetworkProxy proxy;
    proxy.setHostName("127.0.0.1");
    proxy.setPort(8118);
    proxy.setType(QNetworkProxy::HttpProxy);
    QNetworkProxy::setApplicationProxy(proxy);

    // Performance Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LinksIncludedInFocusChain, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::SpatialNavigationEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::Accelerated2dCanvasEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::AcceleratedCompositingEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::DnsPrefetchEnabled, true);

    // Media Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::MediaEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::MediaSourceEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebGLEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebAudioEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::FullScreenSupportEnabled, true);

    // Privacy Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::OfflineStorageDatabaseEnabled, false);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::OfflineWebApplicationCacheEnabled, false);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalStorageDatabaseEnabled, false);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalStorageEnabled, false);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::PrivateBrowsingEnabled, true);

    // Security Settings
    QWebSettings::globalSettings()->setAttribute(QWebSettings::FrameFlatteningEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptCanOpenWindows, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptCanAccessClipboard, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::JavascriptEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalContentCanAccessFileUrls, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::LocalContentCanAccessRemoteUrls, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::PluginsEnabled, false);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::WebSecurityEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::XSSAuditingEnabled, true);
    QWebSettings::globalSettings()->setAttribute(QWebSettings::HyperlinkAuditingEnabled, true);

    // Initialize and show QWebView.
    webView = new QWebView();
    webView->show();

    // Get path of script file.
    QString scriptPath = QDir::homePath() + "/.zsurf/script.js";

    // Load and evaluate script.
    loadScript(scriptPath);
    evaluateScript();

    // Allow live reload of script.
    QFileSystemWatcher watcher;
    watcher.addPath(QDir::homePath() + "/.zsurf/");

    QObject::connect(&watcher, &QFileSystemWatcher::directoryChanged, []()
    {
        qDebug() << "Detected change in script.";
        usleep(1000000);
        //loadScript(scriptPath);
        //evaluateScript();
    });

    // Evaluate script every time page is loaded.
    QObject::connect(webView->page()->mainFrame(), &QWebFrame::javaScriptWindowObjectCleared, []()
    {
        evaluateScript();
        qDebug() << "Script evaluated.";
    });

    loadScript(scriptPath);

    // Bind inspector to key.
    QShortcut *shortcut = new QShortcut(QKeySequence("F12"), webView);
    webView->connect(shortcut, &QShortcut::activated, []()
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

    return application.exec();
}


