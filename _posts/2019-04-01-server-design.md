---
layout: post
title: 'Tomcat架构解析之Lifecycle生命周期的设计'
subtitle: 'Tomcat架构解析之Lifecycle生命周期的设计'
date: 2019-04-01
categories: Tomcat 源码分析
tags: Tomcat 源码分析
---

<div id="toc"></div>


# 主要内容
  
  Tomcat在设计上深刻体现了面向对象的系统设计思想，将不同的功能抽象成不同的功能组件，再通过对象之间的组合完成复杂的功能。本文主要介绍Tomcat的Lifecycle生命周期的设计，后面会继续介绍Tomcat Server包含的主要组件的作用以及组件之间的关系。


# 背景简介
Lifecycle是贯穿整个Tomcat的一个内容，主要是针对Tomcat的整个生命周期和状态的管理，个人觉得状态对于Server来说是一个非常重要的属性，需要根据Server不同的状态来决定Server的进一步操作。设想一下当Server状态变更时，Server涉及到的各个环节和组件都需要同步这种状态的变更，如何更加有效的传递这种状态的变化显得尤为重要。

# Lifecycle相关类的设计
## 状态图
基于[Lifecycle](https://tomcat.apache.org/tomcat-8.0-doc/api/org/apache/catalina/Lifecycle.html)的javadoc文档绘制的状态图，列出了各个状态的转移和转移的条件，如下图所示：

![state_trans](/assets/img/tomcat/tomcat_lifecycle _state_trans.png)


## Lifecycle和LifecycleState,LifecycleSupport
### 类图
![Lifecycle&LifecycleState&LifecycleSupport](/assets/img/tomcat/lifecyclestate&support.png)

### 分析
1. Lifecycle是整个tomcat的生命周期管理的接口定义，里面定义了event常量和生命周期的基本方法，方法如下，很容易理解：
- init():初始化，代表初始化一些资源，比如Bootstrap利用classloader来加载类文件等等；
- start()：开始，代表启动，比如启动服务，准备后台的daemon线程来接受请求等等；
- stop()：停止，代表停止，比如停止接受请求，中断一些操作等；
- destroy()：销毁，代表销毁资源，如关闭socket连接等等操作；

2. LifecycleState是个枚举，定义了状态(state)和事件(event)的关系，关系如下表格：

<center><strong>表格-1</strong> LifecycleState和LifecycleEvent的关系 </center>
<table style="text-align: center;">
  <tr>
    <td style="width: 300px"><strong>LifecycleState</strong></td>
    <td style="width: 300px"><strong>LifecycleEvent</strong></td>
    <td style="width: 200px"><strong>备注</strong></td>
  </tr>
  <tr>
    <td>INITIALIZING</td>
    <td>BEFORE_INIT_EVENT</td>
    <td>正在init</td>
  </tr>
  <tr>
    <td>INITIALIZED</td>
    <td>AFTER_INIT_EVENT</td>
    <td>已经init完成</td>
  </tr>
  <tr>
    <td>STARTING_PREP</td>
    <td>BEFORE_START_EVENT</td>
    <td>准备start</td>
  </tr>
  <tr>
    <td>STARTING</td>
    <td>START_EVENT</td>
    <td>正在start</td>
  </tr>
  <tr>
    <td>STARTED</td>
    <td>AFTER_START_EVENT</td>
    <td>已经start完成</td>
  </tr>
  <tr>
    <td>STOPPING_PREP</td>
    <td>BEFORE_STOP_EVENT</td>
    <td>准备stop</td>
  </tr>
  <tr>
    <td>STOPPING</td>
    <td>STOP_EVENT</td>
    <td>正在stop</td>
  </tr>
  <tr>
    <td>STOPPED</td>
    <td>AFTER_STOP_EVENT</td>
    <td>已经stop完成</td>
  </tr>
  <tr>
    <td>DESTROYING</td>
    <td>BEFORE_DESTROY_EVENT</td>
    <td>正在destroy</td>
  </tr>
  <tr>
    <td>DESTROYED</td>
    <td>AFTER_DESTROY_EVENT</td>
    <td>已经destroy完成</td>
  </tr>
  <tr>
    <td>FAILED</td>
    <td style="font: red">None</td>
    <td>失败</td>
  </tr>
  <tr>
    <td>MUST_STOP</td>
    <td>None</td>
    <td>未看到使用场景，8.0移除该状态</td>
  </tr>
  <tr>
    <td>MUST_DESTROY</td>
    <td>None</td>
    <td>未看到使用场景，8.0移除该状态</td>
  </tr>
</table>

3. LifecycleSupport相当于Lifecycle的一个封装对象，主要是用于处理event操作的一个封装，后续tomcat8.0已经去除


## LifecycleListener和LifecycleEvent
### 类图
![LifecycleListener&LifecycleEvent](/assets/img/tomcat/LifecycleListener&LifecycleEvent.png)

### 分析
LifecycleListener接口只定义了一个方法：lifecycleEvent(LifecycleEvent event)，LifecycleEvent继承了EventObject，封装了Lifecycle对象。看似很简单，但这是非常典型的Event-Listener模式，首先将Listener注册到Lifecycle对象中，当不同的Event发生时，触发注册到Lifecycle对象中的所有Listener来进行各自不同的处理。事件监听机制非常适用于管理对象的生命周期，例如UI界面上的点击事件、spring上都有类似的应用。


## LifecycleBase
### 类图
![LifecycleBase](/assets/img/tomcat/LifecycleBase.png)

### 分析
LifecycleBase是Lifecycle接口实现的一个抽象类，就是将上面Event-Listener模式中的LifecycleListener和LifecycleEvent关联起来的，tomcat里和生命周期相关的类都是基于这个父类的，这个类可以分为三个部分。

#### LifecycleListener

前面几个方法是定义了将listener注册到对象或者从对象中移除，fireLifecycleEvent方法则是listener响应事件（如start、stop等）进行的操作。


#### Internal方法

仔细观察这个类的方法，会发现一定规律，该类在实现lifecycle接口的方法的同时，还依次定义抽象的internal方法，initInternal、startInternal等，这几个抽象方法的作用到底是什么呢？其实上篇文章在介绍StandardServer init的代码中提到了该技巧，我们可以通过start方法的代码来看下，代码如下：

<pre><code class="language-java">
  public final synchronized void start() throws LifecycleException {

        /**
         * 当前状态处于start中的任意状态（STARTING_PREP,STARTING,STARTED）之一,
         * 说明已经处于启动的过程中
         */
        if (LifecycleState.STARTING_PREP.equals(state) ||
                LifecycleState.STARTING.equals(state) ||
                LifecycleState.STARTED.equals(state)) {
            
            if (log.isDebugEnabled()) {
                Exception e = new LifecycleException();
                log.debug(sm.getString("lifecycleBase.alreadyStarted",
                        toString()), e);
            } else if (log.isInfoEnabled()) {
                log.info(sm.getString("lifecycleBase.alreadyStarted",
                        toString()));
            }
            
            return;
        }
        
        if (state.equals(LifecycleState.NEW)) {
            init();
        } else if (state.equals(LifecycleState.FAILED)){
            stop();
        } else if (!state.equals(LifecycleState.INITIALIZED) &&
                !state.equals(LifecycleState.STOPPED)) {
            invalidTransition(Lifecycle.BEFORE_START_EVENT);
        }

        //设置状态为准备启动STARTING_PREP
        setStateInternal(LifecycleState.STARTING_PREP, null, false);

        try {
            //子类启动,子类设置状态为STARTING
            startInternal();
        } catch (Throwable t) {
            ExceptionUtils.handleThrowable(t);
            setStateInternal(LifecycleState.FAILED, null, false);
            throw new LifecycleException(
                    sm.getString("lifecycleBase.startFail",toString()), t);
        }

        if (state.equals(LifecycleState.FAILED) ||
                state.equals(LifecycleState.MUST_STOP)) {
            stop();
        } else {
            // Shouldn't be necessary but acts as a check that sub-classes are
            // doing what they are supposed to.
            if (!state.equals(LifecycleState.STARTING)) {
                invalidTransition(Lifecycle.AFTER_START_EVENT);
            }

            //启动结束，标记状态为已启动
            setStateInternal(LifecycleState.STARTED, null, false);
        }
    }
</code></pre>

这个父类只是更新start操作前和完成后的状态，并没有完成真正意义上的start，真正start所需要完成的操作其实是在子类继承的startInternal方法中实现，init、stop、destroy都是类似的。

#### setState和setStateInternal

我们可以在start的代码当中看到上面这两个方法主要的作用是更新状态，setState是对私有方法setStateInternal的一次封装，用于提供给子类来进行状态的变化，setStateInternal是用于该抽象类内部的状态变化，然后注册的listener根据事件来进行不同的响应。

##### 源码分析

<pre><code class="language-java">
  private synchronized void setStateInternal(LifecycleState state,
            Object data, boolean check) throws LifecycleException {
        
        if (log.isDebugEnabled()) {
            log.debug(sm.getString("lifecycleBase.setState", this, state));
        }

        /**
         * check变量是区分是内部调用,还是子类调用
         * false:内部调用（init、start、stop、destroy）,由于在各自的方法中已经进行了状态转换的校验,
         *       所以不需要再次进行校验。
         * true:子类调用，所有子类在进行状态变化时,需要进行状态的校验
         */
        if (check) {
            if (state == null) {
                invalidTransition("null");
                return;
            }

            /**
             * 发现子类都是通过setState(LifecycleState state, Object data)这个方法来进行状态变化的，
             * 而且全部都是通过startInternal()和stopInternal()两个方法，所以才会有这两种状态规则的校验
             * 子类调用的校验规则：
             * 1.在STARTING时，当前状态一定要STARTING_PREP
             * 2.在STOPPING时，当前状态一定要STOPPING_PREP或者FAILED
             * 3.当前状态已经是FAILED
             */
            if (!(state == LifecycleState.FAILED ||
                    (this.state == LifecycleState.STARTING_PREP &&
                            state == LifecycleState.STARTING) ||
                    (this.state == LifecycleState.STOPPING_PREP &&
                            state == LifecycleState.STOPPING) ||
                    (this.state == LifecycleState.FAILED &&
                            state == LifecycleState.STOPPING))) {
                // No other transition permitted
                invalidTransition(state.name());
            }
        }
        
        this.state = state;
        String lifecycleEvent = state.getLifecycleEvent();
        //注册的LifecycleListener进行不同事件的处理
        if (lifecycleEvent != null) {
            fireLifecycleEvent(lifecycleEvent, data);
        }
    }
</code></pre>  











