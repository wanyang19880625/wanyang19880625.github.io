---
layout: post
title: 'ThreadLocal的使用和总结'
date: 2021-06-30
categories: Java
tags: 多线程
---

### ThreadLocal的使用和总结

参考文章链接：

- https://www.justdojava.com/2019/05/12/java-threadlocal/
- http://www.jasongj.com/java/threadlocal/

#### 没有使用ThreadLocal

原文并没有说明线程不安全的具体原因，在注释出说明一下


<pre><code class="language-java">
/**
 * 线程不安全
 * 主要表现:打印demo对象string可能会出现重复的
 * 原因:string局部变量是9个线程的共享变量,其实是属于MyStringDemo对象的，
        在不同的线程对其进行set操作时是无序的,导致了string对象
        并不是严格的当前线程名称,所以打印时调用的getString()获取值可能会出现重复的情况
 */
public class MyStringDemo {

    private String string;

    private String getString() {
        return string;
    }

    private void setString(String string) {
        this.string = string;
    }

    public static void main(String[] args) {
        int threads = 9;
        MyStringDemo demo = new MyStringDemo();
        CountDownLatch countDownLatch = new CountDownLatch(threads);
        for (int i = 0; i < threads; i++) {
            Thread thread = new Thread(() -&gt; {
                demo.setString(Thread.currentThread().getName());
                System.out.println(demo.getString());
                countDownLatch.countDown();
            }, "thread-" + i);
            thread.start();
        }
    }
}
</code></pre>

打印的具体结果（需要多次执行才能达到结果），发现有重复的名称出现:

> thread-1<br>
> thread-3<br>
> thread-2<br>
> thread-1<br>
> thread-5<br>
> thread-4<br>
> thread-6<br>
> thread-7<br>
> thread-8<br>

#### 使用ThreadLocal

下面这个例子是线程安全的，和之前区别就在于get和set方法使用了ThreadLocal的静态对象。

<pre><code class="language-java">
public class MyThreadLocalStringDemo {
    private static ThreadLocal<String&gt; threadLocal = new ThreadLocal<&gt;();

    private String getString() {
        return threadLocal.get();
    }

    private void setString(String string) {
        threadLocal.set(string);
    }

    public static void main(String[] args) {
        int threads = 9;
        MyThreadLocalStringDemo demo = new MyThreadLocalStringDemo();
        CountDownLatch countDownLatch = new CountDownLatch(threads);
        for (int i = 0; i < threads; i++) {
            Thread thread = new Thread(() -> {
                demo.setString(Thread.currentThread().getName());
                System.out.println(demo.getString());
                countDownLatch.countDown();
            }, "thread-" + i);
            thread.start();
        }
    }
}
</code></pre>

打印结果如下，不可能出现重复的名称:
> thread-1<br>
> thread-3<br>
> thread-2<br>
> thread-0<br>
> thread-5<br>
> thread-4<br>
> thread-6<br>
> thread-7<br>
> thread-8<br>


那么为什么这样可以保证每个线程都获取到自己的名称，而不会和其他线程有冲突的情况出现呢？其实主要是和ThreadLocal这个类中定义的数据结构ThreadLocalMap有关系，主要有以下几点：

- 首先这个ThreadLocalMap对象是Thread类的一个局部变量，<br>也就是说每个Thread都有一个不同的ThreadLocalMap对象，这点保证了线程数据之间的隔离性。

- ThreadLocal的set和get方法会去初始化这个ThreadLocalMap，<br>key是这个ThreadLocal对象，value就是不同线程的ThreadLocalMap对象的值

- 扩展：还可以有其他方式来达到目的吗？

  答案：可以用锁synchronized和lock来保证线程安全，以此来达到数据准确

  例如使用synchronized,例子如下：

<pre><code class="language-java">
  public class MyStringDemo {
  
      private String string;
  
      private String getString() {
          return string;
      }
  
      private void setString(String string) {
          this.string = string;
      }
  
      public static void main(String[] args) {
          int threads = 9;
          MyStringDemo demo = new MyStringDemo();
          CountDownLatch countDownLatch = new CountDownLatch(threads);
          for (int i = 0; i < threads; i++) {
              synchronized (demo) {
                  Thread thread = new Thread(() -> {
                      demo.setString(Thread.currentThread().getName());
                      System.out.println(demo.getString());
                      countDownLatch.countDown();
                  }, "thread-" + i);
                  thread.start();
              }
          }
      }
  }
  </code></pre>

- 扩展问题：弱引用，强引用等等

  答案:
  https://stackoverflow.com/questions/299659/whats-the-difference-between-softreference-and-weakreference-in-java
  https://web.archive.org/web/20061130103858/http://weblogs.java.net/blog/enicholas/archive/2006/05/understanding_w.html

- 扩展问题：ThreadLocal典型的使用场景有哪些

  答案:session场景是典型的threadlocal场景，比如mybatis官方的org.apache.ibatis.session.defaults.DefaultSqlSession就是没有使用threadlocal，不是线程安全的，而对应的SqlSessionManager则是线程安全