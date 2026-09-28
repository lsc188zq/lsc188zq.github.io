---
title: "P10767 「CROI · R2」在相思树下 II"
date: 2026-07-05
category: 知识
tags: ["树形DP"]
description: "首先，我们定义该比赛为一颗二叉树，父节点为子节点的获胜结果（后面泛称为胜利位）子节点则称为比赛位。"
sourcePath: "OI/算法/DP/树形/P10767 「CROI · R2」在相思树下 II.md"
---


首先，我们定义该比赛为一颗二叉树，父节点为子节点的获胜结果（后面泛称为**胜利位**）子节点则称为**比赛位**。

 对于规则 1 ,实力较强者胜出，进入胜利位的选手的范围一定在两个比赛位的范围之间（比赛位的选手比赛后进入胜利位），而选手可以任意组合,两个比赛位可选选手的范围的最大值若在，一定可以进入胜利位，所以胜利位的选手范围的最大值就确定了，即 $ r_f=\max(r_l,r_r) $ 。

至于左边界，举个例子，两个范围为 $1$ 到 $2^n$ 的比赛位，在规则 1 的约束下，除了 $1$ 选手，所有选手都可以进入胜利位，所以胜利位的左边界为 $2$  。

那么再普通一点，这次我们忽略右边界，设一个比赛位的左边界为 $a$ ，另一个左边界为 $b$ ，且  $a<b$ 。  所以胜利位选手的范围一定是要大于 $a$ 的， $a$ 是最小值，也就是说要安排 $a-1$ 个实力小于 $a$ 的选手在先前和 $a$ 比赛才能让 $a$ 到达这个比赛位来让 $a$ 被 $b$ 击败，然而 $b$ 也要经过 $b-1$ 个实力小于它的才能到这个位置.然而他们的要击败的垫脚石却有重复，所以实际上要安排击败 $a+b-1$ 个选手才能让胜利位的选手实力最小，最小值就是 $a+b$ 。其实有 $a+b-1$ 个选手都在递归的左右比赛中被击败，所以总结来说就是 $l_f=l_l+l_r$ 。

规则二也是同理。

至于具体的实现，先处理每个位置的选手范围，从叶节点（第一场比赛）开始逐层向上，时间复杂度为 $\mathcal{O}(n2^n)$ 。因为给出的是 $2^n$ 的范围，所以我们设 $k=2^n$ ， $k\leq10^6$ 所以时间复杂度就变为 $\mathcal{O}(klogk)$ ，可以接受，再统计每一层最大的可能的范围，对于每个询问 $\mathcal{O}(1)$ 回答即可。
    
最后附上代码，里面还有较为详细的具体解释:
```cpp
#include<bits/stdc++.h>
using namespace std;
struct node{
	int l,r,gui; //范围左边界，范围右边界，与比赛规则
};
vector<node> ceng[25];
int cmin[25],cmax[25];
int n,m,g,k;
int main()
{
	ios::sync_with_stdio(false);
	cin.tie(NULL); 
	cout.tie(NULL);
	for (int i=0;i<=24;i++) cmin[i]=1e8; //每一层允许的选手能力最小值
	for (int i=0;i<=24;i++) cmax[i]=0; //每一层允许的选手能力最大值
	cin>>n>>m;
	k=pow(2,n); //选手个数
	for (int j=1;j<=k;j++){
		node p;
		p.l=1; p.r=k; //最底层初始为最大范围
		ceng[n].push_back(p);
	}
	for (int i=0;i<n;i++){
		int y=pow(2,i);
		for (int j=1;j<=y;j++){
			node p;
			cin>>p.gui;
			ceng[i].push_back(p);
		}
	}
	for (int i=n-1;i>=0;i--){
		for (int j=0;j<ceng[i].size();j++){
			if (ceng[i][j].gui==1){
              			//规则1
				ceng[i][j].l=ceng[i+1][j*2].l+ceng[i+1][j*2+1].l;//左边界要求提升
				ceng[i][j].r=max(ceng[i+1][j*2].r,ceng[i+1][j*2+1].r);//右边界取最小
			}
			else{
              			//规则2
				ceng[i][j].l=min(ceng[i+1][j*2].l,ceng[i+1][j*2+1].l);//左边界取最小
				ceng[i][j].r=ceng[i+1][j*2].r+ceng[i+1][j*2+1].r-k-1;//右边界要求提升（值下降）
			}
			cmin[i]=min(cmin[i],ceng[i][j].l);
			cmax[i]=max(cmax[i],ceng[i][j].r);
          		//求每一层最大范围
		}
	}
	while (m--){
		int a,b;
		cin>>a>>b;
		if (b==1||a>=cmin[n-b+1]&&a<=cmax[n-b+1]) cout<<"Yes\n"; //判断
		else cout<<"No\n";
	}
	return 0; 
}
```
