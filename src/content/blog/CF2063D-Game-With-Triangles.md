---
title: "CF2063D Game With Triangles"
date: 2026-07-05
category: 知识
tags: []
description: "赛时先写了个假的贪心，想到正解后赶紧写，最后 10 秒交，结果 k{max} 计算错了。所以想着来写篇题解纪念下。"
sourcePath: "OI/算法/贪心/CF2063D Game With Triangles.md"
---

赛时先写了个假的贪心，想到正解后赶紧写，最后 $10$ 秒交，结果 $k_{max}$ 计算错了。所以想着来写篇题解纪念下。  
首先是有点坑的 $k_{max}$ 的计算，完全可以模拟一遍得出，然而我写了个错的式子，就是某种假掉的贪心。  
首先是一个性质，三角形的高固定为 $2$，因此面积只和其中两个在同一行的点的距离有关，事实上面积的值就是距离的值。所以我们可以将两行的点分别排序再做。  
考虑只有一个三角形时的计算，显然，我们应该取相离最远的同一行的两个点。多个三角形时以此类推，尽量取远的。  
但如果这时候如果发现对面没有一个顶点来配合这同一行的两个点成为顶点了怎么办？这时候我们就考虑释放对面作为底的两个点，成为新的顶点。  
我们来分析这个过程，显然失去了一个三角形，又得到了两个三角形，最后还是新增一个三角形。 
那么我们释放哪两个点呢，显然是相聚最近的两个点。  
于是可以点两两配对（最左边一个，最右边一个成一个组），丢到优先队列里反悔贪心去做。  
Code：

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

const int MAXN=200005;

int T,n,m,k;
int a[MAXN],b[MAXN];
ll ans;
priority_queue<int> qa,qb,_qa,_qb;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr); cout.tie(nullptr);
    cin>>T;
    while (T--){
        cin>>n>>m;
        for (int i=1;i<=n;i++) cin>>a[i];
        for (int i=1;i<=m;i++) cin>>b[i];
        sort(a+1,a+n+1); sort(b+1,b+m+1);
        ans=0;
        int tn=n,tm=m; k=0;
        while (true){
            if (tn<tm) swap(tn,tm);
            if (tn<2||!tm) break;
            ++k;
            tn-=2; tm--;
        }
        cout<<k<<'\n';
        while (!qa.empty()) qa.pop();
        while (!qb.empty()) qb.pop();
        while (!_qa.empty()) _qa.pop();
        while (!_qb.empty()) _qb.pop();
        for (int i=1;i<=n/2;i++) qa.push(a[n-i+1]-a[i]);
        for (int i=1;i<=m/2;i++) qb.push(b[m-i+1]-b[i]);
        for (int i=1;i<=k;i++){
            ll k1=-1e17,k2=-1e17;
            if (n>=2&&m>=2){
                k1=qa.top(); k2=qb.top();
                if (k1>=k2){
                    qa.pop();
                    _qa.push(-k1);
                    ans+=k1;
                    n-=2; m-=1;
                }
                else{
                    qb.pop();
                    _qb.push(-k2);
                    ans+=k2;
                    m-=2; n-=1;
                }
            }
            else if (n>=2){
                k1=qa.top(); qa.pop();
                ans+=k1; _qa.push(-k1);
                if (!m){
                    k2=_qb.top(); _qb.pop();
                    ans+=k2; 
                    k1=qa.top(); qa.pop();
                    ans+=k1; _qa.push(-k1);
                    n-=3;
                }
                else{
                    n-=2; m--;
                }
            }
            else{
                k2=qb.top(); qb.pop();
                ans+=k2; _qb.push(-k2);
                if (!n){
                    k1=_qa.top(); _qa.pop();
                    ans+=k1; 
                    k2=qb.top(); qb.pop();
                    ans+=k2; _qb.push(-k2);
                    m-=3;
                }
                else{
                    m-=2; n--;
                }
            }
            cout<<ans<<' ';
        }
        cout<<'\n';
    }
    return 0;
}
```

