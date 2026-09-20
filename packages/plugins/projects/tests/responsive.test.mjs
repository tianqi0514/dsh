import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const source = await readFile(new URL('../src/client/styles.ts', import.meta.url), 'utf8');
const css = source.match(/`([\s\S]*)`;/)?.[1];
if (!css) throw new Error('projects CSS template not found');
const markup = `<style>${css}</style><section class="wd-projects"><div class="wd-p-shell"><header class="wd-p-top"><button>项目</button><div></div></header><main class="wd-p-main"><nav class="wd-p-tabs"><button>活动记录</button><button>计划</button><button>任务</button><button>资产</button></nav><textarea>保留的项目草稿</textarea></main><aside class="wd-p-aside">项目配置</aside></div></section>`;

test('project workspace uses a responsive configuration drawer without collaboration controls', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(markup);
    const wide = await page.locator('.wd-p-aside').evaluate(node => ({ position: getComputedStyle(node).position, width: node.getBoundingClientRect().width }));
    assert.equal(wide.position, 'static');
    assert.ok(wide.width >= 350);
    assert.equal(await page.getByRole('button', { name: '邀请', exact: true }).count(), 0);
    assert.equal(await page.locator('.wd-p-tabs button').allTextContents().then(rows => rows.join(',')), '活动记录,计划,任务,资产');
    assert.equal(await page.locator('textarea').inputValue(), '保留的项目草稿');

    await page.setViewportSize({ width: 720, height: 900 });
    const narrow = await page.locator('.wd-p-aside').evaluate(node => ({ position: getComputedStyle(node).position, right: getComputedStyle(node).right, width: node.getBoundingClientRect().width }));
    assert.equal(narrow.position, 'absolute');
    assert.equal(narrow.right, '0px');
    assert.ok(narrow.width <= 720);
    assert.equal(await page.locator('textarea').inputValue(), '保留的项目草稿');

    await page.locator('.wd-p-shell').evaluate(node => node.classList.add('aside-collapsed'));
    assert.equal(await page.locator('.wd-p-aside').evaluate(node => getComputedStyle(node).display), 'none');
  } finally {
    await browser.close();
  }
});

test('execution location and main author controls fit the writing task input area',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    for(const viewport of [{width:1280,height:720},{width:1440,height:900}]){
      await page.setViewportSize(viewport);
      await page.setContent(`<style>html,body{height:100%;margin:0}${css}</style><section class="wd-projects"><div class="wd-p-shell"><header class="wd-p-top">项目</header><main class="wd-p-main"><nav class="wd-p-tabs">任务</nav><div class="wd-p-content">项目资料</div><div class="wd-p-task-composition"><label>执行位置<select aria-label="项目执行工作空间"><option>科研楼项目工作目录</option></select></label><label>本次主笔<select aria-label="本次主笔"><option>科研建设可研主笔</option></select></label><small>推荐技能按需加载，实际使用见任务记录。</small></div><div class="wd-p-composer"><textarea>根据项目资料起草可研讨论稿</textarea><footer><button>创建任务</button></footer></div></main><aside class="wd-p-aside">项目配置</aside></div></section>`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const bounds=await page.locator('.wd-p-composer').boundingBox();assert.ok(bounds&&bounds.y+bounds.height<=viewport.height);
      assert.equal(await page.getByLabel('本次主笔').inputValue(),'科研建设可研主笔');
    }
  }finally{await browser.close();}
});
