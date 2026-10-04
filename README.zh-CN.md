<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a>
</p>

# Side View

**看帖子，别丢了时间线。**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-available-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/side-view-%E2%80%94-social-post-s/hbplammjgakmogfiaobijlngllblpjhm)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Chrome](https://img.shields.io/badge/browser-Chrome%20%7C%20Chromium-4285F4?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![last commit](https://img.shields.io/github/last-commit/YoungSx/side-view?label=last%20commit&logo=github)](https://github.com/YoungSx/side-view/commits/main)

![Side View 在 X 上把帖子开在时间线旁边](assets/store/screenshots/01-x-sidebar.jpg)

你肯定有过这种体验：正刷到一半，一条帖子吸引了你的目光，你点进去——整个信息流瞬间没了。想
看回刚才的内容，只能一路往上滚，而一分钟前在读的那些东西，早就找不着了。

Side View 会把这条帖子**开在时间线旁边的侧栏里**。你的动态一动不动地留在原地。看完了、回完
帖、把楼下的回复翻完了，随手关掉——眼前还是同一屏。

支持 **X**、**Bluesky**、**Threads** 和 **小红书**。

---

## 它到底做了什么

在信息流里点任意一条帖子，它不会顶掉整个页面，而是在旁边打开。再点另一条，还是这个位置。
关掉之后，你的时间线原封不动——你根本没离开过。

就这么简单。不用装新应用、不用注册、不用换网站。你还是以你自己的身份登录，帖子也完全按站点
原本的样子呈现：长串回复、图片、视频、投票和评论，一样都不少。

- **开什么由你决定。** 可以把个人主页、话题标签和搜索排除在外，只让帖子用这种方式打开。
- **多宽由你决定。** 320 到 1200 像素随你挑，配合你的窗口大小。
- **导航栏占多少也由你决定。** 可以收成一条窄窄的图标栏，也可以完全保持原样。
- **四种语言。** 英文、简体中文、繁體中文、日本語，也可以直接跟随浏览器。

## 各平台的表现

**在小红书上**，点击笔记封面、标题或作者会在右侧打开笔记或用户主页，完整信息流在左侧重新排布，不遮住任何一列。可以在右栏继续打开主页中的笔记并返回，详情宽度最多占窗口一半。个人主页拦截可以关闭，话题和搜索链接保持原生行为。

**在 X 和 Bluesky 上**，侧栏由 Side View 自己绘制，放在你的信息流旁边。你可以让它占用右侧
原来的边栏，也可以让它和边栏并排、两个都留着。

**在 Threads 首页**，没有边栏可以占用，所以 Side View 复用了 Threads 自带的分栏功能——
一列原生的 Threads 栏，保存在你的 Threads 账号里，每次打开帖子都复用同一列。它的用起来和
任何一列 Threads 分栏没区别：照样能拖动、能调宽度、能按你习惯滚动。
在独立的动态、关注、收藏、已赞、为你推荐、归档、自定义订阅和搜索页面，详情使用临时原生栏，
保留当前地址，不向账号保存新栏目。通过原生栏目菜单即可关闭。独立页面需要容纳两个 640 CSS 像素的栏目和原生导航的
视口宽度；空间不足或原生组件不可用时，保留正常跳转。

![在 Bluesky 上，帖子开在信息流旁边](assets/store/screenshots/02-bluesky-sidebar.jpg)

![在 Threads 上，帖子开在 Threads 自己的分栏里](assets/store/screenshots/03-threads-native-column.jpg)

## 上手

1. 从 [Chrome 应用商店](https://chromewebstore.google.com/detail/side-view-%E2%80%94-social-post-s/hbplammjgakmogfiaobijlngllblpjhm)安装 Side View。
2. 照常打开 X、Bluesky、Threads 或小红书，别的都不用配置。
3. 点一条帖子，它就在时间线旁边打开了。

如果你想让帖子单独占一页，每个详情面板上都有「在新标签页打开」的按钮。

## 你的设置

从浏览器的扩展菜单里打开设置页。它有自己的标签页，不会碍事，改完即时保存。

![Side View 设置页](assets/store/screenshots/04-settings.png)

## 你的隐私

Side View 没有服务器，没有账号，没有任何统计。它只是从你正在看的页面里读出你点的那条帖子，
显示在侧栏里，然后就不再管它。你的设置留在你自己的浏览器里。任何信息都不会被收集、售卖或
发送到别处。

有一点需要说明：Threads 那一列是由 Threads 自己创建、保存到**你的 Threads 账号**里的——
这是 Threads 的行为，不是我们的。关掉 Side View、或者把它卸载，都不会删掉这一列。想删的话，
在 Threads 自己的分栏菜单里点两下就行，细节写在[隐私政策](docs/privacy-policy.md)里。

## 一些说明

- **Side View 是一个独立的扩展**，与 X、Bluesky、Meta 没有任何隶属、背书或赞助关系。
- **网站会变。** Side View 依附在各站点自己的布局上，所以站点一旦改版，功能可能要等更新之后
  才能恢复。到时候记得[告诉我们](docs/support.md)。
- **不用注册账号。** 没有要注册的东西，也没有要付的钱——Side View 就是一个装上即用的浏览器
  扩展。
- **你的时间线永远不会被改动。** Side View 不会重排、隐藏或改写任何内容。关掉之后，页面和你
  操作之前一模一样。

## 获取帮助

问题反馈、功能建议、疑问，都去同一个地方：
**[GitHub Issues](https://github.com/YoungSx/side-view/issues)**。该附上什么，[docs/support.md](docs/support.md)
里有一份简短清单；如果不方便公开留言，那里也留了邮箱。

## 自己动手构建

Side View 是开源的。需要 Node 22+ 和 pnpm 10：

```bash
git clone https://github.com/YoungSx/side-view.git
cd side-view
pnpm install
pnpm dev      # 带热重载的开发构建
pnpm build    # 生产构建 → .output/chrome-mv3
pnpm test     # 跑测试
```

在 `chrome://extensions` 里把 `.output/chrome-mv3` 作为「加载已解压的扩展程序」加载。架构说明、
本地化指南和实机验证清单都在 [docs/development.md](docs/development.md) 里。
