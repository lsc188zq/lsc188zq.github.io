---
title: "P8512 Ynoi Easy Round 2021 TEST_152"
date: 2026-07-05
category: 知识
tags: ["线段树","珂朵莉树"]
description: "转转有一个操作序列(li,ri,vi)。"
sourcePath: "OI/算法/数据结构/珂朵莉树/P8512 Ynoi Easy Round 2021 TEST_152.md"
---

## 题目描述

转转有一个操作序列$(l_i,r_i,v_i)$。

现在，有 $q$ 个询问 $l$,$r$。

每次询问，你初始有一个长度为 $m$ 的序列 $c$，初值全是 $0$。

现在我们从 $l$ 到 $r$ 执行这 $r-l+1$ 个操作。

每个操作是将 $c[l_i]$~$c[r_i]$ 赋值为 $v_i$。

询问所有操作结束后整个 $c$ 的序列所有数的和。

询问之间互相独立。

## 输入格式

第一行三个正整数 $n$,$m$,$q$。

第 $2$~$n+1$ 行,每行 $3$ 个正整数，第 $i+1$ 行表示 $l_i$,$r_i$,$v_i$。

后面 $q$ 行，每行两个正整数，表示一次询问 $l$,$r$。

## 输出格式

$q$ 行，每行一个正整数，表示询问的答案。
## 提示

Idea：Ynoi，Solution：Ynoi，Code：Ynoi，Data：Ynoi

对于 $100\%$ 的数据，满足 

$1 \le n,m,q \le 5 \times 10^5$

$1 \le l_i \le r_i \le m$

$0 \le v_i \le 2 \times 10^9$

$1 \le x_i \le y_i \le n$。

## 题解



## 代码
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
#define lowbit(x) x&-x
const int MAXN=500010;
vector<pair<int,int>> qus[MAXN];
int n,m,q;
int l[MAXN],r[MAXN],k[MAXN];
ll ans[MAXN],fans[MAXN];
template<typename T>
void read(T& x);
template<typename T>
void write(T x);
template<typename T>
void write(T x,char c);

struct node{
    int l,r;
    ll n;
};

struct cho{
    int l,r,t,v;
    bool operator<(const cho& b) const {
        return l<b.l;
    }
};
struct bst{
    node t[MAXN<<2];
    void upd(int p){
        t[p].n=t[p<<1].n+t[p<<1|1].n;
    }
    void build(int p,int l,int r){
        t[p].l=l; t[p].r=r;
        if (l==r) return;
        int mid=l+r>>1;
        build(p<<1,l,mid); build(p<<1|1,mid+1,r);
        upd(p);
        return;
    }
    void add(int p,int x,ll k){
        if (t[p].l==t[p].r){
            t[p].n+=k;
            return;
        }
        int mid=t[p].l+t[p].r>>1;
        if (x<=mid) add(p<<1,x,k);
        else add(p<<1|1,x,k);
        upd(p);
        return;
    }
    ll qus(int p,int l,int r){
        if (t[p].l>r||t[p].r<l) return 0;
        if (t[p].l>=l&&t[p].r<=r) return t[p].n;
        return qus(p<<1,l,r)+qus(p<<1|1,l,r);
    }
}tree;

struct odt{
    set<cho> s;
    odt(){
        s.insert(cho{1,m+1,0,0});
    }
    auto split(int x){
        auto it=s.lower_bound(cho{x,0,0,0});
        if (it!=s.end()&&it->l==x) return it;
        --it;
        int l=it->l,r=it->r,t=it->t,v=it->v;
        s.erase(it);
        s.insert(cho{l,x-1,t,v});
        return s.insert(cho{x,r,t,v}).first;
    }
    void assign(int l,int r,int t,int v){
        auto rit=split(r+1),lit=split(l);
        for (auto it=lit;it!=rit;++it) tree.add(1,it->t,1ll*(it->r-it->l+1)*it->v);
        s.erase(lit,rit);
        s.insert(cho{l,r,t,v});
    }
}odtr;


int main(){
    read(n); read(m); read(q);
    for (int i=1;i<=n;i++) read(l[i]),read(r[i]),read(k[i]);
    for (int i=1;i<=q;i++) {
        int l,r; read(l); read(r); qus[r].pb(mp(i,l));
    }
    tree.build(1,0,n);
    for (int i=1;i<=n;i++){
        odtr.assign(l[i],r[i],i,k[i]);
        ans[i]=ans[i-1]+1ll*(r[i]-l[i]+1)*k[i];
        for (auto e:qus[i]) fans[e.fi]=ans[i]-ans[e.se-1]-tree.qus(1,e.se,i-1);
    }
    for (int i=1;i<=q;i++) cout<<fans[i]<<'\n';
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
```
