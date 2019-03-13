#节点加入网络后，每个矿工节点执行这个脚本，用于异步更新实时资源
#!/bin/bash
while true;
do
        curl -H "Content-type:application/json" --data "{\"ipaddress\":\"192.168.1.56\",\"cpu\":\"$(echo "$(top -b -n 1 | grep Cpu| awk '{print $8}') * $(cat /proc/cpuinfo |grep "processor"|wc -l) * 0.01" | bc)\",\"mem\":\"$(free -m | grep "Mem" | awk '{print $4}')\"}" http://192.168.1.56:3001/register
        sleep 30s
done