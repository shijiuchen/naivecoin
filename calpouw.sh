!/bin/bash
while true;
do
    softname1="asylo"
    softname2="caffe"
    softname3="hadoop"
    mkdir -p /home/syc/naivecoin/log

    name1=`ps aux|grep $softname1 |grep -v grep|grep -v sh`
    name2=`ps aux|grep $softname2 |grep -v grep|grep -v sh`
    name3=`ps aux|grep $softname3 |grep -v grep|grep -v sh`
    if [ ! -n "$name1" ]; then
        name1=$name1
    else
        echo "find asylo"
        while :;
        do
            ps1=`ps aux|grep $softname1 |grep -v grep|grep -v sh|awk '{print $3}'`
            ps2=`ps aux|grep $softname1 |grep -v grep|grep -v sh|awk '{print $4}'`
            echo -e "\t $ps1 " >> /home/syc/naivecoin/log/cpu.txt
            echo -e "\t $ps2 " >> /home/syc/naivecoin/log/mem.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/cpu.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/mem.txt
            a=`ps aux|grep $softname1 |grep -v grep|grep -v sh`
            if [ ! -n "$a" ]; then
                sum1=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/cpu.txt`
                sum2=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/mem.txt`
                sum=$(echo $sum1+$sum2 | bc)
                echo $sum
                echo -e "$sum " >> /home/syc/naivecoin/log/result.txt
                rm /home/syc/naivecoin/log/cpu.txt
                rm /home/syc/naivecoin/log/mem.txt
            break
            fi
            sleep 1
        done
    fi

    if [ ! -n "$name2" ]; then
        name2=$name2
    else
        echo "find caffe"
        while :;
        do
            ps1=`ps aux|grep $softname2 |grep -v grep|grep -v sh|awk '{print $3}'`
            ps2=`ps aux|grep $softname2 |grep -v grep|grep -v sh|awk '{print $4}'`
            echo -e "\t $ps1 " >> /home/syc/naivecoin/log/cpu.txt
            echo -e "\t $ps2 " >> /home/syc/naivecoin/log/mem.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/cpu.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/mem.txt
            a=`ps aux|grep $softname2 |grep -v grep|grep -v sh`
            if [ ! -n "$a" ]; then
                sum1=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/cpu.txt`
                sum2=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/mem.txt`
                sum=$(echo $sum1+$sum2 | bc)
                echo $sum
                echo -e "$sum " >> /home/syc/naivecoin/log/result.txt
                rm /home/syc/naivecoin/log/cpu.txt
                rm /home/syc/naivecoin/log/mem.txt
            break
            fi
            sleep 1
        done
    fi

    if [ ! -n "$name3" ]; then
        name3=$name3
    else
        echo "find hadoop"
        while :;
        do
            ps1=`ps aux|grep $softname3 |grep -v grep|grep -v sh|awk '{print $3}'`
            ps2=`ps aux|grep $softname3 |grep -v grep|grep -v sh|awk '{print $4}'`
            echo -e "\t $ps1 " >> /home/syc/naivecoin/log/cpu.txt
            echo -e "\t $ps2 " >> /home/syc/naivecoin/log/mem.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/cpu.txt
            sed -i 's/^[[:space:]]//g' /home/syc/naivecoin/log/mem.txt
            a=`ps aux|grep $softname3 |grep -v grep|grep -v sh`
            if [ ! -n "$a" ]; then
                sum1=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/cpu.txt`
                sum2=`awk '{sum += $1};END {print sum}' /home/syc/naivecoin/log/mem.txt`
                sum=$(echo $sum1+$sum2 | bc)
                echo $sum
                echo -e "$sum " >> /home/syc/naivecoin/log/result.txt
                rm /home/syc/naivecoin/log/cpu.txt
                rm /home/syc/naivecoin/log/mem.txt
            break
            fi
            sleep 1
        done
    fi
done