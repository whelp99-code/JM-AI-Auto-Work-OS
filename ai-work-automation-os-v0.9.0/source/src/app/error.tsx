"use client";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <div className="page"><div className="card"><h1>화면을 불러오지 못했습니다.</h1><p className="error">{error.message}</p><button className="btn btn-primary" onClick={reset}>다시 시도</button></div></div>}
