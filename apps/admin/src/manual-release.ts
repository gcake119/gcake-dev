import type { ReleaseRecord } from '@gcake/admin-contract';
type ManualPost={slug:string;status:string;saved:boolean;dirty:boolean;revision:string};
type Preview={slug:string;title:string;version:number;revision:string};
export async function reviewManualPublication(
  post:ManualPost,
  request:(path:string,body:Record<string,unknown>)=>Promise<unknown>,
  confirm:(message:string)=>Promise<boolean>,
):Promise<ReleaseRecord|undefined> {
  if(!post.saved || post.dirty || post.status!=='ready')throw new Error('請先儲存並定稿目前內容，再預覽立即發布。');
  const preview=await request('/api/v1/releases/manual-preview',{slug:post.slug}) as Preview;
  if(preview.slug!==post.slug || typeof preview.title!=='string' || !Number.isInteger(preview.version) || typeof preview.revision!=='string')
    throw new Error('發布預覽不完整，尚未提交發布。');
  if(preview.revision!==post.revision)throw new Error('文章內容已更新，請重新開啟文章後再預覽發布。');
  if(!await confirm(`立即發布「${preview.title}」？這次會發布已儲存的內容；仍需等網站更新並確認公開結果。`))return;
  const result=await request('/api/v1/releases/publish-now',{slug:post.slug,version:preview.version,revision:preview.revision,confirmed:true}) as ReleaseRecord;
  if(result.slug!==post.slug || result.mode!=='manual' || typeof result.id!=='string')throw new Error('發布結果尚未確認，請保留原紀錄並核對，不要重送。');
  return result;
}
