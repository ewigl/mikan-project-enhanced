// ==UserScript==
// @name         蜜柑计划 快速下载 - Mikan Project Quick Download
// @namespace    https://github.com/ewigl/mpqd
// @version      0.3.4
// @description  复制磁链时直接打开, 高亮磁链,  通过RPC快速创建aria2下载任务.
// @author       Licht
// @license      MIT
// @homepage     https://github.com/ewigl/mpqd
// @match        http*://mikanani.me/*
// @icon         https://mikanani.me/images/favicon.ico?v=2
// @require      https://unpkg.com/jquery@3.7.1/dist/jquery.min.js
// @require      https://unpkg.com/sweetalert2@11.10.1/dist/sweetalert2.all.min.js
// @connect      localhost
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

;(function () {
    'use strict'

    let styleCSS = `
    .custom-box {
        /* display: none; */
        border-left: 1px solid;
        padding-left: 8px;
    }

    .custom-button {
        color: white;
        background-color: slategrey;
        padding: 4px;
        margin: 8px 0px;
        border: none;
        border-radius: 5px;
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
    
    .highlight-magnet-button {
        background-color: slateblue;
    }
    
    .rpc-settings-button {
        background-color: blueviolet;
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
    let defaultConfig = {
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
        visibleSettings: [
            {
                id: 'magnet-link-box',
                value: 'show_magnet_link',
            },
            {
                id: 'highlight-magnet-box',
                value: 'show_highlight_magnet',
            },
            {
                id: 'rpc-settings-box',
                value: 'show_rpc_settings',
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
            '#888',
        ],
        defaultColor: '#888',
    }

    // 默认 message
    let message = Swal.mixin({
        position: 'center-end',
        toast: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        width: '32rem',
        timer: 5000,
        timerProgressBar: true,
    })

    // 工具
    let util = {
        getValue(name) {
            return GM_getValue(name)
        },
        setValue(name, value) {
            GM_setValue(name, value)
        },
        initDefaultConfig() {
            defaultConfig.rpcSettings.forEach((item) => {
                util.getValue(item.name) === undefined && util.setValue(item.name, item.value)
            })
            defaultConfig.visibleSettings.forEach((item) => {
                util.getValue(item.value) === undefined && util.setValue(item.value, false)
            })
            util.getValue('magnet_highlight_color') === undefined &&
                util.setValue('magnet_highlight_color', defaultConfig.defaultColor)
            GM_addStyle(`.magnet-link {color: ${util.getValue('magnet_highlight_color')}}`)
        },
        getDefaultColorButtonsDom() {
            let dom = ''
            defaultConfig.colorList.forEach((item) => {
                dom += `<div class="highlight-color-dot" style="background-color: ${item}"></div>`
            })
            return dom
        },
        changeVisibility() {
            defaultConfig.visibleSettings.forEach((item) => {
                util.getValue(item.value) ? $('#' + item.id).show() : $('#' + item.id).hide()
            })
        },
        resetDefaultConfig() {
            defaultConfig.rpcSettings.forEach((value) => {
                util.setValue(value.name, value.value)
            })
        },
        sendToRPC: async (magnetLink) => {
            let rpc = {
                address: util.getValue('rpc_address'),
                secret: util.getValue('rpc_secret'),
                dir: util.getValue('rpc_dir').trim() === '' ? undefined : util.getValue('rpc_dir'),
            }

            let rpcData = {
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

    let operation = {
        onCopyMagnet: (event) => {
            let target = event.target
            let magnetLink = $(target).attr('data-clipboard-text')

            // 主 DOM
            let mpqdDom = `
            <!-- 磁链操作 -->
            <div>
                <button id="show-magnet-button" class="custom-button">
                    显示/隐藏磁链
                </button>
                <a href="${magnetLink}">
                    <button class="custom-button">
                        直接打开磁链
                    </button>
                </a>
                <div id="magnet-link-box" class="custom-box">
                    ${magnetLink}
                </div>
            </div>
        
            <!-- 高亮磁链 -->
            <div>
                <button id="highlight-magnet-button" class="custom-button highlight-magnet-button">
                    高亮磁链
                </button>
                <button id="un-highlight-magnet-button" class="custom-button">
                    取消高亮磁链
                </button>
                <div id="highlight-magnet-box" class="custom-box">
                    ${util.getDefaultColorButtonsDom()}
                </div>
            </div>
        
            <!-- RPC 设置 -->
            <div>
                <button id="rpc-settings-button" class="custom-button rpc-settings-button">
                    显示/隐藏 RPC 设置
                </button>
            </div>
            <div id="rpc-settings-box" class="custom-box">
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
                    重置为默认设置
                </button>
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
                        html: mpqdDom,
                        timer: undefined,
                    })
                    .then((result) => {
                        if (result.isConfirmed) {
                            util.sendToRPC(magnetLink)
                        }
                    })
                util.changeVisibility()
            } else {
                message.fire({
                    icon: 'error',
                    title: '未找到磁力链接',
                })
            }
        },
        onClickShowMagnetLinkButton: async () => {
            util.setValue('show_magnet_link', !util.getValue('show_magnet_link'))
            $('#magnet-link-box').toggle()
        },
        onClickHighlightMagnetButton: async () => {
            util.setValue('highlight_magnet', !util.getValue('highlight_magnet'))
            $('#highlight-magnet-box').toggle()
        },
        onClickUnHighlightMagnetButton: async () => {
            util.setValue('magnet_highlight_color', defaultConfig.defaultColor)
            GM_addStyle(`.magnet-link {color: ${util.getValue('magnet_highlight_color')}}`)
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
        onClickRPCSettingsButton: async () => {
            util.setValue('show_rpc_settings', !util.getValue('show_rpc_settings'))
            $('#rpc-settings-box').toggle()
        },
        onResetRPCSettings: async () => {
            util.resetDefaultConfig()
            $('#rpc-address').val(util.getValue('rpc_address'))
            $('#rpc-secret').val(util.getValue('rpc_secret'))
            $('#rpc-dir').val(util.getValue('rpc_dir'))
        },
    }

    // Main
    let main = {
        init() {
            util.initDefaultConfig()
            this.addListeners()
        },
        addListeners() {
            // 入口
            $(document).on('click', '[data-clipboard-text]', operation.onCopyMagnet)
            // 显示磁链
            $(document).on('click', '#show-magnet-button', operation.onClickShowMagnetLinkButton)
            // 高亮磁链
            $(document).on('click', '#highlight-magnet-button', operation.onClickHighlightMagnetButton)
            // 取消高亮
            $(document).on('click', '#un-highlight-magnet-button', operation.onClickUnHighlightMagnetButton)
            // 点击颜色
            $(document).on('click', '#highlight-magnet-box', operation.onClickHighlightMagnetBox)
            // RPC设置
            $(document).on('click', '#rpc-settings-button', operation.onClickRPCSettingsButton)
            // 重置RPC设置
            $(document).on('click', '#rpc-reset-button', operation.onResetRPCSettings)

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

    main.init()
})()
