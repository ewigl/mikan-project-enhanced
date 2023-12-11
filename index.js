// ==UserScript==
// @name         蜜柑计划 快速下载 - Mikan Project Quick Download
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  复制磁力链接时 可以直接打开, 也可以通过 RPC 快速创建 aria2 下载任务
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
    #magnet-link-box {
        display: none;
        border-left: 1px solid;
        padding-left: 8px;
    }

    #rpc-settings-box {
        display: none;
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
                id: 'rpc-settings-box',
                value: 'show_rpc_settings',
            },
        ],
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
            let mpardDom = `
            <div>
                <button id="show-magnet-button" class="custom-button">
                    显示/隐藏磁链
                </button>
                <button id="direct-open-button" class="custom-button">
                    直接打开磁链
                </button>
                <div id="magnet-link-box">
                    ${magnetLink}
                </div>
                <div>
                    <button id="rpc-settings-button" class="custom-button">
                        显示/隐藏 RPC 设置
                    </button>
                </div>
            </div>

            <div id="rpc-settings-box">
                <div>
                    修改时自动保存
                </div>
                <br>
                <div>
                    <label class="rpc-settings-label">
                        <div>RPC地址:</div>
                        <input
                            id="rpc-address"
                            type="text"
                            class="rpc-settings-input"
                            title="默认地址为 http://localhost:6800/jsonrpc"
                            value="${util.getValue('rpc_address')}"
                        >
                    </label>
                </div>
                <div>
                    <label class="rpc-settings-label">
                        <div>RPC密钥:</div>
                        <input
                            id="rpc-secret"
                            type="text"
                            class="rpc-settings-input"
                            title="无密钥时留空"
                            value="${util.getValue('rpc_secret')}"
                        >
                    </label>
                </div>
                <div>
                    <label class="rpc-settings-label">
                        <div>下载目录:</div>
                        <input
                            id="rpc-dir"
                            type="text"
                            class="rpc-settings-input"
                            title="留空则为 aria2 默认路径"
                            value="${util.getValue('rpc_dir')}"
                        >
                    </label>
                </div>
                <button id="rpc-reset-button" class="custom-button">
                    重置为默认设置
                </button>
            </div>
            <div>
                <b>
                    是否使用 Aria2 RPC 下载该磁力链接 ?
                </b>
            </div>
            `

            if (magnetLink) {
                message
                    .fire({
                        icon: 'success',
                        showCancelButton: true,
                        title: '已复制磁力链接到剪切板',
                        html: mpardDom,
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
        directOpenMagnetLink() {
            let magnetLink = $('#magnet-link-box').text()
            window.open(magnetLink)
        },
        onClickShowMagnetLinkButton: async () => {
            util.setValue('show_magnet_link', !util.getValue('show_magnet_link'))
            $('#magnet-link-box').toggle()
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
            // 直接打开
            $(document).on('click', '#direct-open-button', operation.directOpenMagnetLink)
            // 显示磁链
            $(document).on('click', '#show-magnet-button', operation.onClickShowMagnetLinkButton)
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
