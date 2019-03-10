---
layout: post
title: 'Tomcat架构解析之启动的简单流程'
subtitle: 'Tomcat架构解析之启动的简单流程'
date: 2019-03-10
categories: Tomcat 源码分析
tags: Tomcat 源码分析
---

> - 目录：
> <div id="toc"></div>

- 学习的原因

    **Tomcat**是常用的web容器，实现了servlet规范，现在流行的spring框架内部也集成了**Tomcat**，可见其的重要性。**Tomcat**是非常值得大家研究学习的一个框架，里面涉及到Java的各方面的知识，比如设计模式、组件化编程、多线程、IO及NIO的运用、网络Socket编程等等，通过Tomcat不仅可以对Java高级特性的运用从文字转化到具体应用的形式，而且对自己以后的代码设计方面也会有很多提高。


- 内容

  本文主要介绍了 **Tomcat**的整个启动的简单流程，Tomcat源码使用的版本是 **Tomcat 7.0.67**。

- 目的

  通过本文能够对 **Tomcat**的启动流程有基本的认识，主要涉及到三个类：Bootstrap，Catalina，StandardServer.

# 流程序列图

​首先给出启动Tomcat server的一个简单序列图，希望大家在阅读代码之前，对整体流程有个基本的认识，如下图：

![tomcat](/assets/img/tomcat/start.png)
# 初始化init

## Bootstrap init

### 源码解析

<pre><code class="language-java">
    /**
     * Bootstrap init方法
     * Initialize daemon.
     */
    public void init() throws Exception
    {
        /**
         * 设置base和home路径，优先使用
         **/
        setCatalinaHome();
        setCatalinaBase();
        /**
         * 初始化类加载器，加载三种classloader
         * 1.common 2.share 3.server
         **/
        initClassLoaders();
        
        // 设置当前线程的上下文classloader
        Thread.currentThread().setContextClassLoader(catalinaLoader);

        // catalinaLoader加载tomcat相关类
        SecurityClassLoad.securityClassLoad(catalinaLoader);

        // 反射生成Catalina类的实例
        if (log.isDebugEnabled())
            log.debug("Loading startup class");
        Class<?> startupClass =
            catalinaLoader.loadClass
            ("org.apache.catalina.startup.Catalina");
        Object startupInstance = startupClass.newInstance();

        /**
         * 反射获取Catalina的setParentClassLoader方法，
         * 调用该方法设置shared classloader为catalina的父类加载器
         **/
        if (log.isDebugEnabled())
            log.debug("Setting startup class properties");
        String methodName = "setParentClassLoader";
        Class<?> paramTypes[] = new Class[1];
        paramTypes[0] = Class.forName("java.lang.ClassLoader");
        Object paramValues[] = new Object[1];
        paramValues[0] = sharedLoader;
        Method method =
            startupInstance.getClass().getMethod(methodName, paramTypes);
        method.invoke(startupInstance, paramValues);
        
        // 获取到catalina的daemon实例
        catalinaDaemon = startupInstance;

    }
</code></pre>



# 加载load

## Bootstrap load

### 源码解析

<pre><code class="language-java">
    /**
     * Bootstrap load方法
     * Load daemon.
     */
    private void load(String[] arguments)
        throws Exception {
        
        String methodName = "load";
        Object param[];
        Class<?> paramTypes[];
        if (arguments==null || arguments.length==0) {
            paramTypes = null;
            param = null;
        } else {
            paramTypes = new Class[1];
            paramTypes[0] = arguments.getClass();
            param = new Object[1];
            param[0] = arguments;
        }
        // 反射获取Catalina的load()方法，加载相关内容
        Method method =
            catalinaDaemon.getClass().getMethod(methodName, paramTypes);
        if (log.isDebugEnabled())
            log.debug("Calling startup class " + method);
        method.invoke(catalinaDaemon, param);

    }
</code></pre>

## Catalina load

### 源码解析

<pre><code class="language-java">
    /**
     * Catalina load方法
     * Start a new server instance.
     */
    public void load() {

        long t1 = System.nanoTime();

        initDirs();
        initNaming();

        /**
         * 1.创建digester对象，配置相应的规则 --- line 17
         * 2.读取对应xml文件，以流的形式存储   --- line 19到74
         * 3.digester对象解析xml文件，以stack的形式存储，按照配置的规则实例化
             Server，Service，Connector等对象及对象之间的关系。 --- line 77到97
         * 4.调用StandardServer的init方法，初始化Server
         **/
        Digester digester = createStartDigester();

        InputSource inputSource = null;
        InputStream inputStream = null;
        File file = null;
        try {
            try {
                // 默认读取conf/server.xml的配置信息
                file = configFile();
                inputStream = new FileInputStream(file);
                inputSource = new InputSource(file.toURI().toURL().toString());
            } catch (Exception e) {
                if (log.isDebugEnabled()) {
                    log.debug(sm.getString("catalina.configFail", file), e);
                }
            }
            if (inputStream == null) {
                try {
                    inputStream = getClass().getClassLoader()
                        .getResourceAsStream(getConfigFile());
                    inputSource = new InputSource
                        (getClass().getClassLoader()
                         .getResource(getConfigFile()).toString());
                } catch (Exception e) {
                    if (log.isDebugEnabled()) {
                        log.debug(sm.getString("catalina.configFail",
                                getConfigFile()), e);
                    }
                }
            }
            if( inputStream==null ) {
                try {
                    inputStream = getClass().getClassLoader()
                            .getResourceAsStream("server-embed.xml");
                    inputSource = new InputSource
                    (getClass().getClassLoader()
                            .getResource("server-embed.xml").toString());
                } catch (Exception e) {
                    if (log.isDebugEnabled()) {
                        log.debug(sm.getString("catalina.configFail",
                                "server-embed.xml"), e);
                    }
                }
            }
            if (inputStream == null || inputSource == null) {
                if  (file == null) {
                    log.warn(sm.getString("catalina.configFail",
                            getConfigFile() + "] or [server-embed.xml]"));
                } else {
                    log.warn(sm.getString("catalina.configFail",
                            file.getAbsolutePath()));
                    if (file.exists() && !file.canRead()) {
                        log.warn("Permissions incorrect, read permission is not allowed on the file.");
                    }
                }
                return;
            }

            try {
                inputSource.setByteStream(inputStream);
                digester.push(this);
                digester.parse(inputSource);
            } catch (SAXParseException spe) {
                log.warn("Catalina.start using " + getConfigFile() + ": " +
                        spe.getMessage());
                return;
            } catch (Exception e) {
                log.warn("Catalina.start using " + getConfigFile() + ": " , e);
                return;
            }
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (IOException e) {
                    // Ignore
                }
            }
        }

        getServer().setCatalina(this);

        // 日志输出流的重定义
        initStreams();

        try {
            // 调用StandardServer的init方法
            getServer().init();
        } catch (LifecycleException e) {
                           if(Boolean.getBoolean("org.apache.catalina.startup.EXIT_ON_INIT_FAILURE")) {
                throw new java.lang.Error(e);
            } else {
                log.error("Catalina.start", e);
            }

        }

        long t2 = System.nanoTime();
        if(log.isInfoEnabled()) {
            log.info("Initialization processed in " + ((t2 - t1) / 1000000) + " ms");
        }

    }
</code></pre>

Tomcat源码原生配置的server.xml文件如下：

```xml

<Server port="8005" shutdown="SHUTDOWN">
  <Listener className="org.apache.catalina.startup.VersionLoggerListener" />
  <!-- Security listener. Documentation at /docs/config/listeners.html
  <Listener className="org.apache.catalina.security.SecurityListener" />
  -->
  <!--APR library loader. Documentation at /docs/apr.html -->
  <Listener className="org.apache.catalina.core.AprLifecycleListener" SSLEngine="on" />
  <!--Initialize Jasper prior to webapps are loaded. Documentation at /docs/jasper-howto.html -->
  <Listener className="org.apache.catalina.core.JasperListener" />
  <!-- Prevent memory leaks due to use of particular java/javax APIs-->
  <Listener className="org.apache.catalina.core.JreMemoryLeakPreventionListener" />
  <Listener className="org.apache.catalina.mbeans.GlobalResourcesLifecycleListener" />
  <Listener className="org.apache.catalina.core.ThreadLocalLeakPreventionListener" />

  <!-- Global JNDI resources
       Documentation at /docs/jndi-resources-howto.html
  -->
  <GlobalNamingResources>
    <!-- Editable user database that can also be used by
         UserDatabaseRealm to authenticate users
    -->
    <Resource name="UserDatabase" auth="Container"
              type="org.apache.catalina.UserDatabase"
              description="User database that can be updated and saved"
              factory="org.apache.catalina.users.MemoryUserDatabaseFactory"
              pathname="conf/tomcat-users.xml" />
  </GlobalNamingResources>

  <!-- A "Service" is a collection of one or more "Connectors" that share
       a single "Container" Note:  A "Service" is not itself a "Container",
       so you may not define subcomponents such as "Valves" at this level.
       Documentation at /docs/config/service.html
   -->
  <Service name="Catalina">

    <!--The connectors can use a shared executor, you can define one or more named thread pools-->
    <!--
    <Executor name="tomcatThreadPool" namePrefix="catalina-exec-"
        maxThreads="150" minSpareThreads="4"/>
    -->

    <!-- A "Connector" represents an endpoint by which requests are received
         and responses are returned. Documentation at :
         Java HTTP Connector: /docs/config/http.html (blocking & non-blocking)
         Java AJP  Connector: /docs/config/ajp.html
         APR (HTTP/AJP) Connector: /docs/apr.html
         Define a non-SSL HTTP/1.1 Connector on port 8080
    -->
    <Connector port="8080" protocol="HTTP/1.1"
               connectionTimeout="20000"
               redirectPort="8443" />
    <!-- A "Connector" using the shared thread pool-->
    <!--
    <Connector executor="tomcatThreadPool"
               port="8080" protocol="HTTP/1.1"
               connectionTimeout="20000"
               redirectPort="8443" />
    -->
    <!-- Define a SSL HTTP/1.1 Connector on port 8443
         This connector uses the BIO implementation that requires the JSSE
         style configuration. When using the APR/native implementation, the
         OpenSSL style configuration is required as described in the APR/native
         documentation -->
    <!--
    <Connector port="8443" protocol="org.apache.coyote.http11.Http11Protocol"
               maxThreads="150" SSLEnabled="true" scheme="https" secure="true"
               clientAuth="false" sslProtocol="TLS" />
    -->

    <!-- Define an AJP 1.3 Connector on port 8009 -->
    <Connector port="8099" protocol="AJP/1.3" redirectPort="8443" />


    <!-- An Engine represents the entry point (within Catalina) that processes
         every request.  The Engine implementation for Tomcat stand alone
         analyzes the HTTP headers included with the request, and passes them
         on to the appropriate Host (virtual host).
         Documentation at /docs/config/engine.html -->

    <!-- You should set jvmRoute to support load-balancing via AJP ie :
    <Engine name="Catalina" defaultHost="localhost" jvmRoute="jvm1">
    -->
    <Engine name="Catalina" defaultHost="localhost">

      <!--For clustering, please take a look at documentation at:
          /docs/cluster-howto.html  (simple how to)
          /docs/config/cluster.html (reference documentation) -->
      <!--
      <Cluster className="org.apache.catalina.ha.tcp.SimpleTcpCluster"/>
      -->

      <!-- Use the LockOutRealm to prevent attempts to guess user passwords
           via a brute-force attack -->
      <Realm className="org.apache.catalina.realm.LockOutRealm">
        <!-- This Realm uses the UserDatabase configured in the global JNDI
             resources under the key "UserDatabase".  Any edits
             that are performed against this UserDatabase are immediately
             available for use by the Realm.  -->
        <Realm className="org.apache.catalina.realm.UserDatabaseRealm"
               resourceName="UserDatabase"/>
      </Realm>

      <Host name="localhost"  appBase="webapps" unpackWARs="true" autoDeploy="true">
        <!-- SingleSignOn valve, share authentication between web applications
             Documentation at: /docs/config/valve.html -->
        <!--
        <Valve className="org.apache.catalina.authenticator.SingleSignOn" />
        -->
        <!-- Access log processes all example.
             Documentation at: /docs/config/valve.html
             Note: The pattern used is equivalent to using pattern="common" -->
        <Valve className="org.apache.catalina.valves.AccessLogValve"
               directory="logs"  prefix="localhost_access_log." suffix=".txt"
               pattern="%h %l %u %t &quot;%r&quot; %s %b" />

      </Host>
    </Engine>
  </Service>
</Server>

```

​   我们可以看到Server标签下面配置了一个单独的Service，Service标签下面配置了多个Connector，基于不同协议有不同的Connector，例如http、ajp、apr等，Connector用于接受request和response，真正处理请求的是内部的Container，对应的是Engine标签，一个Container共享多个Connector。

### 需要注意的地方

​   [Digester](https://tomcat.apache.org/tomcat-7.0-doc/api/index.html)据说是Apache Struts项目中用来解析xml文件的一个api，后来直接运用到Tomcat项目中，对于Struts不太了解，但是这种实例化对象的方法使用上感觉有点臃肿而且晦涩难懂，不太了解使用这种方法的原因以及优势。

## StandardServer init

### 源码解析

<pre><code class="language-java">
    /**
     * StandardServer 初始化
     */
    protected void initInternal() throws LifecycleException {
        
        super.initInternal();

        // jmx相关初始化
        onameStringCache = register(new StringCache(), "type=StringCache");

        MBeanFactory factory = new MBeanFactory();
        factory.setContainer(this);
        onameMBeanFactory = register(factory, "type=MBeanFactory");
        
        // JNDI相关资源初始化
        globalNamingResources.init();
        
        // 加载相关资源的jar
        if (getCatalina() != null) {
            ClassLoader cl = getCatalina().getParentClassLoader();
            // Walk the class loader hierarchy. Stop at the system class loader.
            // This will add the shared (if present) and common class loaders
            while (cl != null && cl != ClassLoader.getSystemClassLoader()) {
                if (cl instanceof URLClassLoader) {
                    URL[] urls = ((URLClassLoader) cl).getURLs();
                    for (URL url : urls) {
                        if (url.getProtocol().equals("file")) {
                            try {
                                File f = new File (url.toURI());
                                if (f.isFile() &&
                                        f.getName().endsWith(".jar")) {
                                    ExtensionValidator.addSystemResource(f);
                                }
                            } catch (URISyntaxException e) {
                                // Ignore
                            } catch (IOException e) {
                                // Ignore
                            }
                        }
                    }
                }
                cl = cl.getParent();
            }
        }
        // server.xml配置的service初始化
        for (int i = 0; i < services.length; i++) {
            services[i].init();
        }
    }
</code></pre>

### 需要注意的地方

​   这里省略了一些调用步骤，应该会有人奇怪，为什么之前调用的是init方法，到这里怎么变成了initInternal方法了？原因是StandardServer没有实现init方法，实际上是调用了父抽象类的LifecycleBase的init方法，父类的init方法内部调用了抽象方法initInternal，而抽象方法initInternal在不同的子类中有不同的实现，将抽象类的公共方法和不同子类的实现结合起来，这是抽象类的一种应用场景。Tomcat生命周期管理的代码结构就是这种方式来，包括下面**StandardServer start**这一小节也是类似的，后面会专门进行介绍。



# 启动start

## Bootstrap start

### 源码解析

<pre><code class="language-java">
    /**
     * Bootstrap start
     */
    public void start() throws Exception {
        // 如果没有初始化，先初始化
        if( catalinaDaemon==null ) 
            init();
        
        // 反射执行Catalina的start方法
        Method method = catalinaDaemon.getClass().getMethod("start",(Class [])null);
        method.invoke(catalinaDaemon, (Object [])null);

    }
</code></pre>



## Catalina start

### 源码解析

<pre><code class="language-java">
    /**
     * Catalina start.
     */
    public void start() {
        // 若StandardServer未初始化，先执行load方法初始化StandardServer
        if (getServer() == null) {
            load();
        }

        if (getServer() == null) {
            log.fatal("Cannot start server. Server instance is not configured.");
            return;
        }

        long t1 = System.nanoTime();

        // 启动StandardServer
        try {
            getServer().start();
        } catch (LifecycleException e) {
            log.fatal(sm.getString("catalina.serverStartFail"), e);
            try {
                getServer().destroy();
            } catch (LifecycleException e1) {
                log.debug("destroy() failed for failed Server ", e1);
            }
            return;
        }

        long t2 = System.nanoTime();
        if(log.isInfoEnabled()) {
            log.info("Server startup in " + ((t2 - t1) / 1000000) + " ms");
        }

        /**
         * 注册后台shutdown hook，用来处理tomcat的shutdown操作
         * 曾在skywalking的源码中也看到过类似的处理，一般都是启动daemon守护线程，
         * 用来处理关闭资源等操作
         **/
        if (useShutdownHook) {
            if (shutdownHook == null) {
                shutdownHook = new CatalinaShutdownHook();
            }
            Runtime.getRuntime().addShutdownHook(shutdownHook);

            // If JULI is being used, disable JULI's shutdown hook since
            // shutdown hooks run in parallel and log messages may be lost
            // if JULI's hook completes before the CatalinaShutdownHook()
            LogManager logManager = LogManager.getLogManager();
            if (logManager instanceof ClassLoaderLogManager) {
                ((ClassLoaderLogManager) logManager).setUseShutdownHook(
                        false);
            }
        }

        
        if (await) {
            await();
            stop();
        }
    }
</code></pre>



## StandardServer start

### 源码解析

<pre><code class="language-java">
    /**
     * StandardServer start
     */
    protected void startInternal() throws LifecycleException {
        //生命周期及其状态的变化
        fireLifecycleEvent(CONFIGURE_START_EVENT, null);
        setState(LifecycleState.STARTING);

        //JNDI资源启动
        globalNamingResources.start();

        // 启动server内部的standard service
        synchronized (services) {
            for (int i = 0; i < services.length; i++) {
                services[i].start();
            }
        }
    }
</code></pre>

# 总结

- **Tomcat**本质是一个web容器，容器通过Java的类加载机制（classloader）来加载 **Tomcat**所需要的类（class），再通过反射机制实例化对象，整个 **Tomcat**在配置文件和xml文件的解析中大量使用了该机制，和spring基于配置编程的基本思想是一致的。
- 整个 **Tomcat**的启动不仅仅包含了上面这几个组件的启动，还包含了各种组件生命周期和状态的管理等等，是个非常复杂的过程，上面这个文章只是简单描述了 **Tomcat**启动过程中相对重要的几个组件，由于这部分内容很多，后续还会对**Tomcat**中使用到的重要组件单独进行更加详细的介绍。

