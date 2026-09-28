---
title: "CF2013D Minimize the Difference"
date: 2026-07-05
category: 知识
tags: ["贪心","数学"]
description: "由于可以执行任意次操作，所以原操作可以转化为将前面的数转移到后面。"
sourcePath: "OI/算法/贪心/CF2013D Minimize the Difference.md"
---

由于可以执行**任意次**操作，所以原操作可以转化为将前面的数转移到后面。  
也就是说，前面的数可以任意小，而后面的数则可以变大。  

然后答案一定是要更接近均值才更优（使得极差更小）。

因此最小值我们可以从前往后扫描每个数，计算前缀平均值（向下取整）并取最小值来得到。  
而最大值可以从后向前扫描每个数，计算后缀平均值（向上取整）并取最大值。

可以证明这是正确的。

记 $sq$ 为前缀和序列，$sh$为后缀和序列。  
事实上最后答案求的正是：
$$ \overset{n}{\max_{i=1}}\lceil sh_{n-i+1}/i \rceil - \overset{n}{\min_{i=1}}\lfloor sq_i/i \rfloor $$
### Code:
```cpp
#include<bits/stdc++.h>
using namespace std;
#define ll long long
ll T,n,a[200010];
int main(){
	ios::sync_with_stdio(false); cin.tie(nullptr); cout.tie(nullptr);
	cin>>T;
    while (T--){
        cin>>n;
        for (int i=1;i<=n;i++) cin>>a[i];
        ll sum1=0,sum2=0,ans1=1e18,ans2=-1e18;
        for (int i=1;i<=n;i++) sum1+=a[i],ans1=min(ans1,sum1/i);
        for (int i=n;i>=1;i--) sum2+=a[i],ans2=max(ans2,((sum2-1)/(n-i+1)+1));
        cout<<ans2-ans1<<'\n';
    }
	return 0;
}
```
