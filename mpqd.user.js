// ==UserScript==
// @name         蜜柑计划 快速下载 - Mikan Project Quick Download
// @namespace    https://github.com/ewigl/mpus
// @version      0.6.5
// @description  高亮磁链, (批量)复制磁链(时/后)直接打开, 通过RPC快速创建aria2下载任务.
// @author       Licht
// @license      MIT
// @homepage     https://github.com/ewigl/mpus
// @match        http*://mikanani.me/*
// @match        http*://mikanime.tv/*
// @icon         https://mikanani.me/images/favicon.ico?v=2
// @require      https://unpkg.com/jquery@3.7.1/dist/jquery.min.js
// @require      https://unpkg.com/sweetalert2@11.10.1/dist/sweetalert2.all.min.js
// @connect      localhost
// @connect      *
// @grant        GM_info
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

;(function () {
    'use strict'

    const styleCSS = `
    
    .js-expand_bangumi-subgroup {
        cursor: alias;
    }

    .table-striped th {
        cursor: alias;
    }

    .custom-box {
        border-left: 2px solid;
        padding-left: 8px;
        margin-bottom: 16px;
    }

    .custom-button {
        color: white;
        background-color: slategrey;
        padding: 4px;
        margin: 8px 0px;
        border: none;
        border-radius: 5px;
    }

    .custom-title {
        color: black;
        font-size: 16px;
        font-weight: bold;
    }

    #instant_open_input {
        width: 16px;
        height: 16px;
    }
       
    .highlight-color-dot {
        display: inline-block;
        width: 20px;
        height: 20px;
        margin: 2px;
        border: 1px solid black;
        border-radius: 50%;
        cursor: pointer;
    }
    
    .rpc-settings-label {
        display: flex;
        align-items: center;
    }
    
    .rpc-settings-label div {
        width: 20%;
    }
    
    .rpc-settings-input {
        display: inline-block;
        flex: 1;
        height: 32px;
        padding: 5px;
        border: 1px solid;
        border-radius: 5px;
    }
    `
    GM_addStyle(styleCSS)

    // 默认设置
    const defaultConfig = {
        rpcSettings: [
            {
                name: 'rpc_address',
                value: 'http://localhost:6800/jsonrpc',
            },
            {
                name: 'rpc_secret',
                value: '',
            },
            {
                name: 'rpc_dir',
                value: '',
            },
        ],
        colorList: [
            '#ff530e',
            '#fe9b36',
            '#edcf00',
            '#32b16c',
            '#00b8ee',
            '#546fb4',
            '#8956a1',
            '#59b7d0',
            '#4cb665',
            '#fff',
            '#000',
            '#f00',
            //
        ],
        defaultColor: '#888',
    }

    // 默认 message
    const message = Swal.mixin({
        position: 'center-end',
        toast: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        width: '32rem',
        timer: 5000,
        timerProgressBar: true,
    })

    // 工具
    const util = {
        getValue(name) {
            return GM_getValue(name)
        },
        setValue(name, value) {
            GM_setValue(name, value)
        },
        getDefaultColorButtonsDom() {
            let dom = ''
            defaultConfig.colorList.forEach((item) => {
                dom += `<div class="highlight-color-dot" style="background-color: ${item}"></div>`
            })
            return dom
        },
        resetToDefaultRPCConfig() {
            defaultConfig.rpcSettings.forEach((value) => {
                util.setValue(value.name, value.value)
            })
        },
        batchCopy(targetElement) {
            // get elements that have attr "data-clipboard-text"
            let magnetElements = $(targetElement).find('[data-clipboard-text]')

            // map to array
            let magnetLinks = []
            magnetElements.each((_index, element) => {
                magnetLinks.push($(element).attr('data-clipboard-text'))
            })

            if (magnetLinks.length) {
                let cilpboardSet = false
                try {
                    GM_setClipboard(magnetLinks.join('\n'))
                    cilpboardSet = true
                } catch (error) {
                    console.log(error)
                } finally {
                    if (cilpboardSet) {
                        message
                            .fire({
                                showCloseButton: true,
                                showCancelButton: true,
                                title: '已复制该分组下全部磁力链接到剪切板',
                                html: '<b> 是否使用 Aria2 RPC 批量下载所有磁力链接 ? </b>',
                            })
                            .then((result) => {
                                if (result.isConfirmed) {
                                    // cycle send to rpc
                                    util.sendToRPC(magnetLinks)
                                }
                            })
                    } else {
                        message.fire({
                            icon: 'error',
                            title: '复制磁力链接失败',
                        })
                    }
                }
            } else {
                message.fire({
                    icon: 'error',
                    title: '未找到磁力链接',
                })
            }
        },
        sendToRPC: async (magnetLinks) => {
            let rpc = {
                address: util.getValue('rpc_address'),
                secret: util.getValue('rpc_secret'),
                dir: util.getValue('rpc_dir').trim() === '' ? undefined : util.getValue('rpc_dir'),
            }

            let rpcData = magnetLinks.map((magnetLink) => {
                return {
                    id: new Date().getTime(),
                    jsonrpc: '2.0',
                    method: 'aria2.addUri',
                    params: [
                        `token:${rpc.secret}`,
                        [magnetLink],
                        {
                            dir: rpc.dir,
                        },
                    ],
                }
            })

            GM_xmlhttpRequest({
                method: 'POST',
                url: rpc.address,
                data: JSON.stringify(rpcData),
                onload: (response) => {
                    let resJson = JSON.parse(response.responseText)

                    if (resJson.result) {
                        message.fire({
                            icon: 'success',
                            title: 'RPC请求发送成功, 请前往控制台查看',
                        })
                    } else {
                        message.fire({
                            icon: 'error',
                            title: 'RPC请求发送失败, 请检查RPC设置是否正确',
                            text: `${resJson.error.code} / ${resJson.error.message}`,
                        })
                    }
                },
                onerror: (error) => {
                    message.fire({
                        icon: 'error',
                        title: 'RPC请求发送失败, 请检查RPC设置是否正确',
                        text: JSON.stringify(error),
                    })
                },
                onabort: () => {
                    message.fire({
                        icon: 'error',
                        title: '内部错误',
                    })
                },
            })
        },
    }

    const operation = {
        onClickSettingsButton: () => {
            // 主 DOM
            let mpqdDom = `
            <!-- 高亮磁链 -->
            <div class="custom-box">
                <div class="custom-title">
                    复制单个磁链时直接打开:
                </div>
                <div>
                    不再弹出RPC下载提示框
                </div>
                <input id="instant_open_input" type="checkbox" ${util.getValue('magnet_link_instant_open') ? 'checked' : ''} />
            </div>

            <!-- 高亮磁链 -->
            <div class="custom-box">
                <div class="custom-title">
                    高亮磁链:
                </div>
                <div id="highlight-magnet-box">
                    ${util.getDefaultColorButtonsDom()}
                </div>
                <button id="un-highlight-magnet-button" class="custom-button">
                    取消高亮磁链
                </button>
            </div>
        
            <!-- RPC 设置 -->
            <div id="rpc-settings-box" class="custom-box">
                <b class="custom-title">
                    RPC 设置:
                </b>
                <div>
                    修改时自动保存
                </div>
                <br>
                <div>
                    <label class="rpc-settings-label">
                        <div>RPC地址:</div>
                        <input id="rpc-address" type="text" class="rpc-settings-input"
                            title="默认地址为 http://localhost:6800/jsonrpc" value="${util.getValue('rpc_address')}">
                    </label>
                </div>
                <div>
                    <label class="rpc-settings-label">
                        <div>RPC密钥:</div>
                        <input id="rpc-secret" type="text" class="rpc-settings-input" title="无密钥时留空"
                            value="${util.getValue('rpc_secret')}">
                    </label>
                </div>
                <div>
                    <label class="rpc-settings-label">
                        <div>下载目录:</div>
                        <input id="rpc-dir" type="text" class="rpc-settings-input" title="留空则为 aria2 默认路径"
                            value="${util.getValue('rpc_dir')}">
                    </label>
                </div>
                <button id="rpc-reset-button" class="custom-button rpc-settings-button">
                    重置RPC设置
                </button>
            </div>
            `

            message.fire({
                title: 'MPQD 设置',
                html: mpqdDom,
                timer: undefined,
            })
        },
        onCopyMagnet: (event) => {
            let target = event.target
            let magnetLink = $(target).attr('data-clipboard-text')

            let instantOpen = util.getValue('magnet_link_instant_open')
            if (instantOpen) {
                // 创建一个虚拟链接并点击
                let a = document.createElement('a')
                a.href = magnetLink
                a.click()

                return
            }

            // onCopy DOM
            let onCopyDom = `
            <div>
                <a href="${magnetLink}">
                    <button class="custom-button">
                        直接打开磁链
                    </button>
                </a>
            </div>
        
            <!-- 提示 -->
            <div>
                <b>
                    是否使用 Aria2 RPC 下载该磁力链接 ?
                </b>
            </div>
            `

            if (magnetLink) {
                message
                    .fire({
                        showCloseButton: true,
                        showCancelButton: true,
                        title: '已复制磁力链接到剪切板',
                        html: onCopyDom,
                    })
                    .then((result) => {
                        if (result.isConfirmed) {
                            util.sendToRPC([magnetLink])
                        }
                    })
            } else {
                message.fire({
                    icon: 'error',
                    title: '未找到磁力链接',
                })
            }
        },
        onSubClick: (event) => {
            // to "stopPropagation"
            // if target has no class "js-expand_bangumi-subgroup" or "tag-res-name", return
            if (!$(event.target).hasClass('js-expand_bangumi-subgroup') && !$(event.target).hasClass('tag-res-name')) return

            let currentTarget = event.currentTarget
            // get data-bangumisubgroupindex
            let bangumiSubGroupIndex = $(currentTarget).attr('data-bangumisubgroupindex')
            // get mid-frame element js-expand_bangumi-subgroup-x-episodes
            let episodesElement = $('.js-expand_bangumi-subgroup-' + bangumiSubGroupIndex + '-episodes')[0]

            if (episodesElement) {
                util.batchCopy(episodesElement)
            }
        },
        ontableHeaderClick: (event) => {
            let target = event.target
            let currentTable = event.currentTarget
            // if click on th
            if ($(target).is('th') && currentTable) {
                util.batchCopy(currentTable)
            }
        },
        onClickHighlightMagnetBox: async (event) => {
            let target = event.target
            // 避免点击Box空白处时触发
            if ($(target).prop('id') === 'highlight-magnet-box') {
                return
            }
            let color = $(target).css('background-color')
            util.setValue('magnet_highlight_color', color)
            GM_addStyle(`.magnet-link { color: ${color}; }`)
        },
        onClickUnHighlightMagnetButton: async () => {
            util.setValue('magnet_highlight_color', defaultConfig.defaultColor)
            GM_addStyle(`.magnet-link {color: ${util.getValue('magnet_highlight_color')}}`)
        },
        onResetRPCSettings: async () => {
            util.resetToDefaultRPCConfig()
            $('#rpc-address').val(util.getValue('rpc_address'))
            $('#rpc-secret').val(util.getValue('rpc_secret'))
            $('#rpc-dir').val(util.getValue('rpc_dir'))
        },
    }

    const initAction = {
        initDefaultConfig() {
            defaultConfig.rpcSettings.forEach((item) => {
                util.getValue(item.name) === undefined && util.setValue(item.name, item.value)
            })

            // 是否立即打开磁链
            util.getValue('magnet_link_instant_open') === undefined && util.setValue('magnet_link_instant_open', false)

            // 高亮磁链颜色
            util.getValue('magnet_highlight_color') === undefined &&
                util.setValue('magnet_highlight_color', defaultConfig.defaultColor)
            // 添加style以高亮磁链
            GM_addStyle(`.magnet-link {color: ${util.getValue('magnet_highlight_color')}}`)
        },
        // check scriptHandler
        getScriptHandler() {
            // "Violentmonkey" or "Tampermonkey"
            // console.log(GM_info)
            return GM_info.scriptHandler
        },
        // check if in main or sub page
        checkListNav() {
            return $('#an-list-nav').length > 0
        },
        checkLeftbarNav() {
            return $('.leftbar-nav').length > 0
        },
        checkClassicView() {
            return $('.classic-view-pagination1').length > 0
        },
        addSettingsButtonToListNav() {
            // main & sub page
            const settingsButtonDom = `
            <div id="mpqd-settings-button" class="sk-col my-rss-date indent-btn" title="蜜柑计划 快速下载 - MPQD 设置">
                <i class="fa fa-2x fa-sliders"></i>
            </div>
            `
            $('#an-list-nav').append(settingsButtonDom)
        },
        addSettingsButtonToLeftbarNav() {
            // search & bangumi page
            const settingsButton = `
            <button id="mpqd-settings-button" class="btn logmod-submit" data-bangumiid="2968" data-subtitlegroupid=""> MPQD 设置 </button>
            `
            $('.leftbar-nav')[0].insertAdjacentHTML('beforeend', settingsButton)
        },
        addSettingsButtonToClassicView() {
            // classic view
            const settingsButton = `
            <div class="classic-view-pagination1 pull-left" style="margin-top: -10px;">
                <div id="mpqd-settings-button" class="pagination" style="font-size: 1rem; cursor: pointer;" title="蜜柑计划 快速下载 - MPQD 设置">
                    <i class="fa fa-2x fa-sliders"></i>
                </div>
            </div>
            `
            $('.classic-view-pagination1').before(settingsButton)
        },
        addListeners() {
            // 设置
            $(document).on('click', '#mpqd-settings-button', operation.onClickSettingsButton)

            // onCopy
            $(document).on('click', '[data-clipboard-text]', operation.onCopyMagnet)

            // onSubClick
            $(document).on('click', '.js-expand_bangumi-subgroup', operation.onSubClick)

            // ontableHeaderClick
            $(document).on('click', '.table-striped', operation.ontableHeaderClick)

            // 设置高亮颜色
            $(document).on('click', '#highlight-magnet-box', operation.onClickHighlightMagnetBox)

            // 取消高亮
            $(document).on('click', '#un-highlight-magnet-button', operation.onClickUnHighlightMagnetButton)

            // 重置RPC设置
            $(document).on('click', '#rpc-reset-button', operation.onResetRPCSettings)

            // 是否直接打开磁链的checkbox
            $(document).on('change', '#instant_open_input', (e) => {
                util.setValue('magnet_link_instant_open', e.target.checked)
            })
            // RPC表单
            $(document).on('input', '#rpc-address', async (e) => {
                util.setValue('rpc_address', e.target.value)
            })
            $(document).on('input', '#rpc-secret', async (e) => {
                util.setValue('rpc_secret', e.target.value)
            })
            $(document).on('input', '#rpc-dir', async (e) => {
                util.setValue('rpc_dir', e.target.value)
            })
        },
    }

    // Main
    const main = {
        init() {
            // check scriptHandler
            // var mpusScriptHandler = initAction.getScriptHandler()

            // 初始化配置
            initAction.initDefaultConfig()

            // 添加设置按钮
            initAction.checkListNav() && initAction.addSettingsButtonToListNav()
            initAction.checkLeftbarNav() && initAction.addSettingsButtonToLeftbarNav()
            initAction.checkClassicView() && initAction.addSettingsButtonToClassicView()

            // 添加监听
            initAction.addListeners()
        },
    }

    main.init()
})()
