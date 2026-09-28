---
title: "P4197 Peaks"
date: 2026-07-05
category: 知识
tags: ["线段树","可持久化","生成树","Kruskal重构树"]
description: "加强版（强制在线）：[P7834 [ONTAK2010] Peaks 加强版 - 洛谷](https://www.luogu.com.cn/problem/so…"
sourcePath: "OI/算法/图论/生成树/P4197 Peaks.md"
---


加强版（强制在线）：[P7834 [ONTAK2010] Peaks 加强版 - 洛谷](https://www.luogu.com.cn/problem/solution/P7834)
## 题目描述

在 Bytemountains 有 $n$ 座山峰，每座山峰有他的高度 $h_i$。有些山峰之间有双向道路相连，共 $m$ 条路径，每条路径有一个困难值，这个值越大表示越难走。  

现在有 $q$ 组询问，每组询问询问从点 $v$ 开始只经过困难值小于等于 $x$ 的路径所能到达的山峰中第 $k$ 高的山峰，如果无解输出 $-1$。

## 输入格式

第一行三个数 $n,m,q$。
第二行 $n$ 个数，第 $i$ 个数为 $h_i$。

接下来 $m$ 行，每行三个整数 $a,b,c$，表示从 $a \to b$ 有一条困难值为 $c$ 的双向路径。
接下来 $q$ 行，每行三个数 $v,x,k$，表示一组询问。

## 输出格式

对于每组询问，输出一个整数表示能到达的山峰中第 $k$ 高的山峰的高度。

### 数据规模与约定
对于 $100\%$ 的数据，$n \le 10^5$，$0 \le m,q \le 5\times 10^5$，$h_i,c,x \le 10^9$。

## 题解
显然可以离线然后合并权值线段树，然而如果强制在线要怎么做。
一个序列中第 $k$ 大数是很典的做法，加上了一个限制就不好做了，我们考虑如何通过一些方法来处理这个限制使得题目变得可做。

我们会发现，维护山峰可达关系只要建出一颗树即可，而显然我们尽可能应该走困难值更小的边。参照**Kruskal最小生成树算法**的思想，我们可以从小到大枚举边，把连通块合并起来。我们会发现，在这个过程中，对于两个连通块而言，显然第一条连通它们的边就是最短的，这条边也被称之为 **瓶颈边** 。我们考虑每次连边连通两个连通块时都创建一个新点作为原来两个连通块对应点的父亲，这个新点的点权是它的孩子的点权的最大值，就这样生成一颗新树，这就叫做**Kruskal重构树**。

**Kruskal重构树**有什么性质呢。如果原图有$n$个节点，那么显然重构树有 $2n-1$ 个节点。它还是一颗有根树，满足大根堆性质。还有一个更加重要的性质，**Kruskal重构树**上两个节点的**LCA**的权值就是这两个节点间最大边权。（当然以上比较也可以反着来。）

回到本题，我们可以建立一颗**Kruskal重构树**，然后进行动态开点可持久化权值线段树的合并，这里不是重点就不展开说了。

Code（放的是加强版的代码）:
```cpp
#include<bits/stdc++.h>
using namespace std;
#define ll long long
#define lll __int128
#define ull unsigned long long
#define pb push_back
#define fi first
#define se second
#define mp make_pair
const int MAXN=100010,L=-1,R=1e9+1;

//struct
struct edge{
    int u,v,k;
};
struct node{
    int l,r,n;
};
struct bst{
    node t[MAXN<<6];
    int cnt;
    int clone(int p);
    void upd(int p);
    int add(int p,int l,int r,int x,int k);
    int qus(int p,int l,int r,int k);
    int merge(int a,int b,int l,int r);
}tree;

//func;
bool cmp(edge a,edge b);
template<typename T>
void read(T& x);
template<typename T>
void write(T x);
template<typename T>
void write(T x,char c);
void init();
void dfs(int x);
int solve();
int find(int x);

//data
int T,n,m,q,k,cnt,ans,v,x,t;
int a[MAXN],st[25][MAXN*2],fa[MAXN*2],ml[MAXN*2],root[MAXN*2],son[2][MAXN*2];
edge es[MAXN*5];
int main(){
    read(n); read(m); read(q); 
    for (int i=1;i<=n;i++) read(a[i]);
    for (int i=1;i<=m;i++) read(es[i].u),read(es[i].v),read(es[i].k);
    init();
    while (q--) {
    	read(v); read(x); read(t);
		v=(v^ans)%n+1;
		t=(t^ans)%n+1;
		x=x^ans;
		ans=solve();
		write(ans,'\n');
		if (ans<0) ans=0;
	}
    return 0;
}

template<typename T>
void read(T& x){
    x=0; bool f=0; char ch=getchar();
    while (ch>'9'||ch<'0') {
        if (ch=='-') f=1;
        ch=getchar();
    }
    while (ch<='9'&&ch>='0') x=x*10+ch-'0',ch=getchar();
    x=f?-x:x;
    return;
}
template<typename T>
void write(T x){
    if (x<0) putchar('-'),x=-x;
    if (x>9) write(x/10);
    putchar(x%10+'0');
    return;
}
template<typename T>
void write(T x,char c){
    write(x);
    putchar(c);
    return;
}
bool cmp(edge a,edge b){
    return a.k<b.k;
}
int find(int x){
    if (x==fa[x]) return x;
    else return fa[x]=find(fa[x]);
}
int bst::clone(int p){
    t[++cnt]=t[p];
    return cnt;
}
void bst::upd(int p){
    t[p].n=t[t[p].l].n+t[t[p].r].n;
}
int bst::add(int p,int l,int r,int x,int k){
    p=clone(p);
    if (l==r){
        t[p].n+=k;
        return p;
    }
    int mid=l+r>>1;
    if (x<=mid) t[p].l=add(t[p].l,l,mid,x,k);
    else t[p].r=add(t[p].r,mid+1,r,x,k);
    upd(p);
    return p;
}
int bst::qus(int p,int l,int r,int k){
    if (l==r) return l;
    int mid=l+r>>1;
    if (k<=t[t[p].r].n) return qus(t[p].r,mid+1,r,k);
    else return qus(t[p].l,l,mid,k-t[t[p].r].n);
}
int bst::merge(int a,int b,int l,int r){
    if (!a||!b) return a+b;
    a=clone(a);
    if (l==r){
        t[a].n+=t[b].n;
        return a;
    }
    int mid=l+r>>1;
    t[a].l=merge(t[a].l,t[b].l,l,mid);
    t[a].r=merge(t[a].r,t[b].r,mid+1,r);
    upd(a);
    return a;
}
void init(){
    cnt=n;
    for (int i=1;i<=n;i++) fa[i]=i;
    sort(es+1,es+m+1,cmp);
    for (int i=1;i<=m;i++){
        int u=find(es[i].u); int v=find(es[i].v);
        if (u!=v){
            fa[u]=fa[v]=st[0][u]=st[0][v]=++cnt;
            fa[cnt]=cnt;
            son[0][cnt]=u; son[1][cnt]=v;
            ml[cnt]=max({ml[u],ml[v],es[i].k});
        }
    }
    k=log2(cnt);
    ml[0]=(1<<30)-1+(1<<30);
    for (int i=1;i<=k;i++)
        for (int j=1;j<=cnt;j++)
            st[i][j]=st[i-1][st[i-1][j]];
    for (int i=1;i<=cnt;i++) if (!st[0][i]) dfs(i);
}
void dfs(int x){
    if (x<=n) root[x]=tree.add(0,L,R,a[x],1);
    else {
        dfs(son[0][x]); dfs(son[1][x]);
        root[x]=tree.merge(root[son[0][x]],root[son[1][x]],L,R);
    }
}
int solve(){
    for (int i=k;i>=0;i--)
        if (ml[st[i][v]]<=x)
            v=st[i][v];
	return tree.qus(root[v],L,R,t);
}
```
