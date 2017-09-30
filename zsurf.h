#ifndef ZSURF_H
#define ZSURF_H

    #include <QApplication>
    #include <QShortcut>
    #include <QWidget>
    #include <QDataStream>
    #include <QFileSystemWatcher>
    #include <QWebChannel>
    #include <QNetworkProxy>
    #include <QNetworkConfiguration>
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
    #include <QObject>
    #include <QWebEngineView>
    #include <QWebEnginePage>
    #include <QWebEngineProfile>
    #include <QWebEngineSettings>
    #include <QWebEngineHistory>
    #include <QWebEngineScript>
    #include <QWebEngineFullScreenRequest>
    #include <QWebEngineScriptCollection>
    #include <QWebEngineUrlRequestInterceptor>
    #include <QWebEngineUrlRequestInfo>

    class ZWebEngineView;
    class ZWebEngineUrlRequestInterceptor;
    class ZBrowser;

    class Promise : public QObject
    {
        Q_OBJECT
        Q_PROPERTY(int length READ getLength WRITE setLength NOTIFY lengthChanged)
    public:
        int length;
        int getLength() const;
        void setLength(int length);

    signals:
        void resolve();
        void reject();
        void lengthChanged();
    };

    class ZTab : public QObject
    {
        Q_OBJECT
        Q_PROPERTY(float zoomFactor READ getZoomFactor WRITE setZoomFactor NOTIFY zoomFactorChanged)

    public:
        ZTab();
        ~ZTab();
        float getZoomFactor() const;
        void setZoomFactor(float zoomFactor);
    signals:
        void zoomFactorChanged();
    private:
        float zoomFactor;
    };

    class ZTabs : public QObject
    {
        Q_OBJECT
    public:
        //Q_INVOKABLE Promise getZoom(float& zoomFactor);
        //Q_INVOKABLE Promise setZoom(int tabId, float zoomFactor);
        Q_INVOKABLE int getCurrent();
        ZTabs();

    private:
        QList<ZTab*> tabsList;
        int current;
    };


    class ZBrowser : public QObject
    {
        Q_OBJECT
    //    Q_PROPERTY(ZTabs* tabs READ getTabs WRITE setTabs NOTIFY tabsChanged)
    public:
        ZTabs* tabs;
        ZBrowser();
        ZTabs* getTabs() const;
        void setTabs(ZTabs* tabs);
    //signals:
        //void tabsChanged();
    private:
        ZWebEngineView* webEngineView;
        QWebEngineProfile* profile;
    };
#endif // ZSURF_H
